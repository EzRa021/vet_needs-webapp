import { sendEmail } from '@/lib/email/send'
import { newOrderStaffEmail } from '@/lib/email/templates'
import { parseShippingAddress } from '@/lib/order-status'

// Who hears about new orders by email.
//
//   ORDER_ALERT_EMAIL  comma-separated, e.g. "owner@gmail.com, packer@gmail.com"
//   otherwise          the shop's own sending inbox (GMAIL_USER), so a shop on
//                      the Gmail provider gets alerts with no extra setup
//
// Returns [] when neither is set — then nothing is sent.
export function orderAlertRecipients() {
  const raw = process.env.ORDER_ALERT_EMAIL || process.env.GMAIL_USER || ''
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => /^[^\s@]+@[^\s@]+$/.test(s)))]
}

// Email shop staff about a new order. Never throws: this runs after checkout
// has already answered the customer, and a mail problem must stay a log line.
export async function sendNewOrderAlert(order) {
  try {
    const recipients = orderAlertRecipients()
    if (!recipients.length || !order?.id) return

    const address = parseShippingAddress(order.shipping_address)
    const contact = {
      name: address.name,
      email: order.email || address.email,
      phone: address.phone,
      // The address block minus the name line (shown separately above it).
      addressLines: address.lines.slice(1),
    }
    const { subject, html, text } = newOrderStaffEmail(order, contact)

    // One message per person, so one bad address can't sink the rest, and
    // each person's reply goes straight to the customer.
    await Promise.all(
      recipients.map((to) =>
        sendEmail({ to, subject, html, text, replyTo: contact.email || undefined })
      )
    )
  } catch (error) {
    console.error('New order alert email failed (order is still created):', error.message)
  }
}
