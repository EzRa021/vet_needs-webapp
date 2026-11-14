// Email sending — provider-agnostic.
//
// TWO RULES, both because of what these emails are attached to:
//
// 1. NOT CONFIGURED IS NOT AN ERROR. With no provider set this logs what it
//    would have sent and returns {skipped}. Throwing would let a missing env
//    var take down checkout, since the receipt is sent from the payment path.
//
// 2. A FAILED SEND NEVER FAILS THE CALLER. Every send is caught here. A paid
//    order must be marked paid whether or not mail went out — a missing receipt
//    is a support ticket; an unpaid-but-charged order is a refund.
//
// THREE PROVIDERS, chosen by which env vars exist, first match wins:
//
//   ZeptoMail — ZEPTOMAIL_TOKEN + EMAIL_FROM. Zoho's transactional service,
//               the sending half of a Zoho setup: people read and reply in
//               Zoho Mail, the app sends through ZeptoMail. Needs the domain
//               verified in ZeptoMail. Pay-as-you-go: the first 10,000 emails
//               are free, then about $2.50 per 10,000.
//               (Zoho Mail's free plan itself is webmail only — it has no
//               SMTP, so an app can't send through it.)
//   Resend    — RESEND_API_KEY + EMAIL_FROM. Also needs a verified domain.
//   Gmail     — GMAIL_USER + GMAIL_APP_PASSWORD. No domain required, so it's
//               the start-today option. `from` is the Gmail address (Gmail
//               rewrites it to the authenticated account regardless), with the
//               shop name as the display name.
//
// EMAIL_FROM is "VetNeeds <orders@jvigor.com.ng>" or a bare address.
// EMAIL_REPLY_TO is where customers' replies land — a Zoho Mail inbox.
//
// ⚠️ Gmail caveats worth knowing: ~500 sends/day, Google may throttle or flag
// automated sending, and a receipt from a @gmail.com address reads as a side
// project. It's a bridge until a domain, not the destination.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
// Zoho's own SDK sends here. ZEPTOMAIL_API_URL overrides it, for the case
// where the ZeptoMail dashboard shows a different API host for the account.
const ZEPTOMAIL_ENDPOINT = 'https://api.zeptomail.com/v1.1/email'
// A send that hangs must not hold a request open: receipts go out from the
// payment path and new-order alerts from after().
const SEND_TIMEOUT_MS = 15000

function activeProvider() {
  if (process.env.ZEPTOMAIL_TOKEN && process.env.EMAIL_FROM) return 'zeptomail'
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return 'resend'
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail'
  return null
}

export const isEmailConfigured = () => activeProvider() !== null

// "VetNeeds <orders@jvigor.com.ng>" → { name: 'VetNeeds', address: 'orders@jvigor.com.ng' }
// "orders@jvigor.com.ng"            → { name: <fallback>, address: 'orders@jvigor.com.ng' }
export function parseAddress(value, fallbackName) {
  const raw = String(value || '').trim()
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/)
  if (m) return { address: m[2], ...(m[1].trim() ? { name: m[1].trim() } : fallbackName ? { name: fallbackName } : {}) }
  return { address: raw, ...(fallbackName ? { name: fallbackName } : {}) }
}

// Replies should reach a human. For Gmail that's the Gmail account itself; for
// ZeptoMail and Resend it's EMAIL_REPLY_TO if set — a sending service has no
// inbox, so point this at the Zoho Mail mailbox staff actually read.
function replyToFor(provider, explicit) {
  if (explicit) return explicit
  if (provider === 'gmail') return process.env.GMAIL_USER
  return process.env.EMAIL_REPLY_TO || undefined
}

async function sendViaResend({ to, subject, html, text, replyTo }) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: data?.message || `HTTP ${res.status}` }
  }
  return { ok: true, id: data.id }
}

async function sendViaZeptoMail({ to, subject, html, text, replyTo }) {
  // The dashboard shows the token with its scheme ("Zoho-enczapikey …"); accept
  // it pasted either way.
  const token = process.env.ZEPTOMAIL_TOKEN.trim()
  const authorization = /^Zoho-enczapikey\s/i.test(token) ? token : `Zoho-enczapikey ${token}`
  const brand = process.env.EMAIL_FROM_NAME || 'VetNeeds'

  const res = await fetch(process.env.ZEPTOMAIL_API_URL || ZEPTOMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: parseAddress(process.env.EMAIL_FROM, brand),
      to: [{ email_address: parseAddress(to) }],
      subject,
      htmlbody: html,
      textbody: text,
      ...(replyTo ? { reply_to: [parseAddress(replyTo)] } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // { data: { error_code, message, details? }, message: 'error' }
    const e = data?.error || data?.data || {}
    const detail = Array.isArray(e.details) && e.details[0]?.message ? ` (${e.details[0].message})` : ''
    return { ok: false, error: `${e.code || e.error_code || `HTTP ${res.status}`}: ${e.message || 'send failed'}${detail}` }
  }
  return { ok: true, id: data?.request_id }
}

// nodemailer is imported lazily so it's only pulled in when Gmail is actually
// the chosen provider — the Resend path (and the no-op path) never load it.
let transporter = null
async function gmailTransport() {
  if (transporter) return transporter
  const { default: nodemailer } = await import('nodemailer')
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      // A Google APP PASSWORD (16 chars), never the account password — the real
      // password won't work with 2FA on, which it should be.
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
  return transporter
}

async function sendViaGmail({ to, subject, html, text, replyTo }) {
  const tx = await gmailTransport()
  const brand = process.env.EMAIL_FROM_NAME || 'VetNeeds'
  const info = await tx.sendMail({
    // Gmail rewrites the address to the authenticated account, so only the
    // display name is really ours — which is the point.
    from: `"${brand}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  })
  return { ok: true, id: info.messageId }
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  const provider = activeProvider()

  if (!provider) {
    // Loud enough to find in a dev log, quiet enough not to be an incident.
    console.info(
      `[email] skipped (no provider configured) → to=${to} subject="${subject}"`
    )
    return { ok: false, skipped: true }
  }

  try {
    const args = { to, subject, html, text, replyTo: replyToFor(provider, replyTo) }
    const send = { zeptomail: sendViaZeptoMail, resend: sendViaResend, gmail: sendViaGmail }[provider]
    const result = await send(args)

    if (!result.ok) {
      console.error(`[email] ${provider} send failed to=${to}:`, result.error)
    }
    return result
  } catch (error) {
    // Network blip, auth failure, timeout — none of it is the caller's problem.
    console.error(`[email] ${provider} threw for to=${to}:`, error.message)
    return { ok: false, error: error.message }
  }
}
