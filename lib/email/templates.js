import { formatNaira } from '@/lib/pricing'
import { formatQuantity } from '@/lib/units'
import { LEGAL } from '@/lib/legal'

// Order emails.
//
// Deliberately plain HTML with inline styles and a table layout: email clients
// are not browsers. Gmail strips <style> blocks, Outlook renders via Word, and
// flexbox/grid are unreliable. This is one of the few places where 2005 markup
// is the correct engineering choice, not laziness.
//
// Every template also ships a text/plain alternative — some clients show it,
// and spam filters treat html-only mail with suspicion.

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://vetneeds.ng'

// A guest has no account, so their order link carries its token. A signed-in
// customer gets the account URL — no token to leak into an inbox.
export function orderUrl(order) {
  return order.guest_token
    ? `${appUrl()}/order/${order.id}?token=${order.guest_token}`
    : `${appUrl()}/account/orders/${order.id}`
}

const ref = (order) => order.id.slice(0, 8).toUpperCase()

function layout({ heading, intro, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7f2;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #e6ebe2;">
            <span style="font-size:20px;font-weight:800;color:#1f6b45;">${LEGAL.brand}</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;">${heading}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">${intro}</p>
            ${bodyHtml || ''}
            ${
              ctaUrl
                ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                     <tr><td style="background:#1f6b45;border-radius:10px;">
                       <a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${ctaLabel}</a>
                     </td></tr>
                   </table>`
                : ''
            }
            ${
              footerNote
                ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${footerNote}</p>`
                : ''
            }
          </td></tr>
          <tr><td style="padding:20px 28px;border-top:1px solid #e6ebe2;font-size:12px;color:#94a3b8;">
            ${LEGAL.brand} · <a href="mailto:${LEGAL.supportEmail}" style="color:#2f80ed;">${LEGAL.supportEmail}</a><br/>
            Questions? Just reply to this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function itemsTable(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : []
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;font-size:14px;border-bottom:1px solid #f1f5f0;">
          ${i.name}<br/><span style="color:#64748b;font-size:13px;">${formatQuantity(i.quantity, i.unit_type)} @ ${formatNaira(i.price)}</span>
        </td>
        <td style="padding:8px 0;font-size:14px;text-align:right;border-bottom:1px solid #f1f5f0;white-space:nowrap;">
          ${formatNaira(i.price * i.quantity)}
        </td>
      </tr>`
    )
    .join('')

  const line = (label, value, bold) =>
    `<tr>
      <td style="padding:4px 0;font-size:${bold ? '15px' : '14px'};${bold ? 'font-weight:700;' : 'color:#64748b;'}">${label}</td>
      <td style="padding:4px 0;font-size:${bold ? '15px' : '14px'};text-align:right;${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${rows}
    <tr><td colspan="2" style="height:10px;"></td></tr>
    ${order.subtotal != null ? line('Subtotal', formatNaira(order.subtotal)) : ''}
    ${Number(order.discount_amount) > 0 ? line(`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`, `−${formatNaira(order.discount_amount)}`) : ''}
    ${order.shipping_fee != null ? line('Shipping', Number(order.shipping_fee) === 0 ? 'Free' : formatNaira(order.shipping_fee)) : ''}
    ${Number(order.tax_amount) > 0 ? line('VAT', formatNaira(order.tax_amount)) : ''}
    ${line('Total', formatNaira(order.total_amount), true)}
  </table>`
}

function itemsText(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : []
  return items
    .map((i) => `  ${formatQuantity(i.quantity, i.unit_type)} x ${i.name} — ${formatNaira(i.price * i.quantity)}`)
    .join('\n')
}

export function orderConfirmedEmail(order) {
  const url = orderUrl(order)
  return {
    subject: `Order #${ref(order)} confirmed — ${LEGAL.brand}`,
    html: layout({
      heading: 'Thanks — your order is confirmed',
      intro: `We've received your payment for order <strong>#${ref(order)}</strong> and we're getting it ready.`,
      bodyHtml: itemsTable(order),
      ctaLabel: 'Track your order',
      ctaUrl: url,
      footerNote: order.guest_token
        ? 'Save this email — the link above is the only way to see this order, since it was placed without an account.'
        : 'You can follow your order any time from your account.',
    }),
    text: `Thanks — your order is confirmed

Order #${ref(order)}

${itemsText(order)}

Total: ${formatNaira(order.total_amount)}

Track your order: ${url}
${order.guest_token ? '\nSave this email — that link is the only way to see this order, since it was placed without an account.' : ''}

${LEGAL.brand} · ${LEGAL.supportEmail}`,
  }
}

// Back in stock (022). The one email where speed is the entire product — a feed
// that's back gets bought today or not at all.
export function backInStockEmail(item) {
  const url = `${appUrl()}/product/${item.id}`
  return {
    subject: `${item.name} is back in stock — ${LEGAL.brand}`,
    html: layout({
      heading: `${item.name} is back`,
      intro: `You asked us to let you know. It's in stock now — but we can't hold it, so first come first served.`,
      bodyHtml: `<p style="margin:0;font-size:18px;font-weight:700;">${formatNaira(item.price)}${
        item.unit_type === 'kg' ? ' / kg' : ''
      }</p>`,
      ctaLabel: 'Buy it now',
      ctaUrl: url,
      footerNote:
        "You're getting this because you asked to be told about this one product. It's a one-off — you're not subscribed to anything.",
    }),
    text: `${item.name} is back in stock

${formatNaira(item.price)}${item.unit_type === 'kg' ? ' / kg' : ''}

You asked us to let you know. We can't hold stock, so first come first served.

${url}

You're getting this because you asked about this one product — it's a one-off, you're not subscribed to anything.

${LEGAL.brand} · ${LEGAL.supportEmail}`,
  }
}

export function orderShippedEmail(order) {
  const url = orderUrl(order)
  return {
    subject: `Order #${ref(order)} is on its way — ${LEGAL.brand}`,
    html: layout({
      heading: 'Your order is on its way',
      intro: `Order <strong>#${ref(order)}</strong> has left us and is heading to you.`,
      bodyHtml: order.tracking_number
        ? `<p style="margin:0 0 8px;font-size:14px;color:#475569;">Tracking number</p>
           <p style="margin:0;padding:12px 16px;background:#f5f7f2;border-radius:10px;font-family:monospace;font-size:15px;font-weight:600;">${order.tracking_number}</p>`
        : '',
      ctaLabel: 'Track your order',
      ctaUrl: url,
    }),
    text: `Your order is on its way

Order #${ref(order)}
${order.tracking_number ? `Tracking: ${order.tracking_number}` : ''}

Track: ${url}

${LEGAL.brand} · ${LEGAL.supportEmail}`,
  }
}

export function orderDeliveredEmail(order) {
  const url = orderUrl(order)
  return {
    subject: `Order #${ref(order)} delivered — ${LEGAL.brand}`,
    html: layout({
      heading: 'Delivered',
      intro: `Order <strong>#${ref(order)}</strong> has been marked as delivered. We hope your animals approve.`,
      ctaLabel: 'View your order',
      ctaUrl: url,
      footerNote:
        "If anything isn't right, just reply to this email and we'll sort it out.",
    }),
    text: `Delivered

Order #${ref(order)} has been marked as delivered.

View: ${url}

If anything isn't right, reply to this email.

${LEGAL.brand} · ${LEGAL.supportEmail}`,
  }
}
