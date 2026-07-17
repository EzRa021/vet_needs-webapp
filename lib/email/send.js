// Email sending, via Resend's HTTP API (no SDK — it's one POST).
//
// TWO RULES, both learned from what these emails are attached to:
//
// 1. NOT CONFIGURED IS NOT AN ERROR. Without RESEND_API_KEY this logs what it
//    would have sent and returns. The alternative — throwing — would mean a
//    missing env var takes down checkout, because the confirmation email is
//    sent from the payment path.
//
// 2. A FAILED EMAIL NEVER FAILS THE CALLER. Every send is caught here. An
//    order the customer has paid for must be marked paid whether or not
//    Resend is reachable; a missing receipt is a support ticket, an unpaid
//    order is a lost sale and a refund.
//
// Setup (both env vars): RESEND_API_KEY, and EMAIL_FROM as a verified sender
// on a domain you own — e.g. "PetDo <orders@petdo.ng>".

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY)

export async function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!key || !from) {
    // Loud enough to find in a dev log, quiet enough not to be an incident.
    console.info(
      `[email] skipped (RESEND_API_KEY/EMAIL_FROM not set) → to=${to} subject="${subject}"`
    )
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error(`[email] send failed (${res.status}) to=${to}:`, data?.message || data)
      return { ok: false, error: data?.message || `HTTP ${res.status}` }
    }

    return { ok: true, id: data.id }
  } catch (error) {
    // Network blip, DNS, timeout — none of it is the caller's problem.
    console.error(`[email] send threw for to=${to}:`, error.message)
    return { ok: false, error: error.message }
  }
}
