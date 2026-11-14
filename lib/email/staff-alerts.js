import { isEmailConfigured, sendEmail } from '@/lib/email/send'
import { newOrderStaffEmail } from '@/lib/email/templates'
import { parseShippingAddress } from '@/lib/order-status'
import { createAdminClient } from '@/lib/supabase/admin'

export const MAX_ALERT_RECIPIENTS = 5
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

// "a@x.com, b@y.com" → ['a@x.com', 'b@y.com'] — trimmed, lower-cased,
// de-duplicated, invalid entries dropped.
export function parseEmailList(raw) {
  return [
    ...new Set(
      String(raw || '')
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => EMAIL.test(s))
    ),
  ].slice(0, MAX_ALERT_RECIPIENTS)
}

// The address saved in Settings (key `order_alert_email`). Read with the
// service role: the row is private (is_public = false), and this runs during a
// customer's checkout, whose session — often a guest's — can only read public
// settings.
async function savedAlertEmail() {
  try {
    const { data } = await createAdminClient()
      .from('settings')
      .select('value')
      .eq('key', 'order_alert_email')
      .maybeSingle()
    return typeof data?.value === 'string' ? data.value : ''
  } catch {
    return ''
  }
}

// Who hears about new orders by email, first match wins:
//   1. Settings › Notifications › Order alert email (set by an admin)
//   2. ORDER_ALERT_EMAIL env var (comma-separated)
//   3. the shop's own inbox: GMAIL_USER, or EMAIL_REPLY_TO (the Zoho Mail
//      mailbox) when sending through ZeptoMail or Resend
// Returns { recipients, source }; recipients is [] when none is set.
const shopInbox = () => {
  const gmail = parseEmailList(process.env.GMAIL_USER)
  return gmail.length ? gmail : parseEmailList(process.env.EMAIL_REPLY_TO)
}

export async function orderAlertRecipients() {
  const saved = parseEmailList(await savedAlertEmail())
  if (saved.length) return { recipients: saved, source: 'settings' }
  const fromEnv = parseEmailList(process.env.ORDER_ALERT_EMAIL)
  if (fromEnv.length) return { recipients: fromEnv, source: 'env' }
  const inbox = shopInbox()
  if (inbox.length) return { recipients: inbox, source: 'inbox' }
  return { recipients: [], source: null }
}

// Where alerts go when the Settings field is blank — shown under the field.
export const fallbackAlertRecipients = () =>
  parseEmailList(process.env.ORDER_ALERT_EMAIL).length
    ? parseEmailList(process.env.ORDER_ALERT_EMAIL)
    : shopInbox()

export { isEmailConfigured }

function contactFor(order) {
  const address = parseShippingAddress(order.shipping_address)
  return {
    name: address.name,
    email: order.email || address.email,
    phone: address.phone,
    // The address block minus the name line (shown separately above it).
    addressLines: address.lines.slice(1),
  }
}

async function sendToAll(recipients, order, { subjectPrefix = '' } = {}) {
  const contact = contactFor(order)
  const { subject, html, text } = newOrderStaffEmail(order, contact)
  // One message per person, so one bad address can't sink the rest, and
  // each person's reply goes straight to the customer.
  return Promise.all(
    recipients.map(async (to) => ({
      to,
      ...(await sendEmail({
        to,
        subject: subjectPrefix + subject,
        html,
        text,
        replyTo: contact.email || undefined,
      })),
    }))
  )
}

// Email shop staff about a new order. Never throws: this runs after checkout
// has already answered the customer, and a mail problem must stay a log line.
export async function sendNewOrderAlert(order) {
  try {
    if (!order?.id) return
    const { recipients } = await orderAlertRecipients()
    if (!recipients.length) return
    await sendToAll(recipients, order)
  } catch (error) {
    console.error('New order alert email failed (order is still created):', error.message)
  }
}

// Settings › "Send test email": the real template with a sample order, so
// staff see exactly what a new-order email will look like, and where it lands.
export async function sendTestOrderAlert() {
  const { recipients, source } = await orderAlertRecipients()
  if (!recipients.length) return { recipients, source, results: [] }

  const sample = {
    id: '00000000-0000-4000-8000-000000000000',
    user_id: 'sample',
    email: null,
    created_at: new Date().toISOString(),
    subtotal: 37000,
    shipping_fee: 1500,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 38500,
    order_items: [{ id: 'sample', name: 'Layer Mash 25kg (sample item)', quantity: 2, price: 18500, unit_type: 'piece' }],
    shipping_address: 'Sample Customer\n12 Allen Avenue\nIkeja, Lagos\nNG\nPhone: 0800 000 0000',
    notes: 'This is a test. No order was placed.',
  }
  const results = await sendToAll(recipients, sample, { subjectPrefix: '[Test] ' })
  return { recipients, source, results }
}
