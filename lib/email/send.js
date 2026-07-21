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
// TWO PROVIDERS, chosen by which env vars exist:
//
//   Resend  — RESEND_API_KEY + EMAIL_FROM. Needs a verified sending domain.
//             The right answer once vetneeds.ng exists.
//   Gmail   — GMAIL_USER + GMAIL_APP_PASSWORD. No domain required, so it's the
//             start-today option. `from` is the Gmail address (Gmail rewrites it
//             to the authenticated account regardless), with the shop name as
//             the display name.
//
// Resend wins if both are set — a domain sender always beats a personal inbox.
//
// ⚠️ Gmail caveats worth knowing: ~500 sends/day, Google may throttle or flag
// automated sending, and a receipt from a @gmail.com address reads as a side
// project. It's a bridge until a domain, not the destination.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

function activeProvider() {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return 'resend'
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail'
  return null
}

export const isEmailConfigured = () => activeProvider() !== null

// Replies should reach a human. For Gmail that's the Gmail account itself; for
// Resend it's EMAIL_REPLY_TO if set (e.g. point a domain sender at your Gmail).
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
    const result =
      provider === 'resend' ? await sendViaResend(args) : await sendViaGmail(args)

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
