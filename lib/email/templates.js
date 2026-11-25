import { formatNaira } from '@/lib/pricing'
import { formatQuantity } from '@/lib/units'
import { LEGAL } from '@/lib/legal'
import { deliveryFeeLabel, formatWeight, isQuoteDelivery, mapsLink, pickupMapLink } from '@/lib/delivery'
import { PRODUCTION_URL } from '@/lib/site-url'

// Order emails.
//
// Deliberately plain HTML with inline styles and a table layout: email clients
// are not browsers. Gmail strips <style> blocks, Outlook renders via Word, and
// flexbox/grid are unreliable. This is one of the few places where 2005 markup
// is the correct engineering choice, not laziness.
//
// Every template also ships a text/plain alternative — some clients show it,
// and spam filters treat html-only mail with suspicion.

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL

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
  <body style="margin:0;padding:0;background:#eef3f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:20px;font-weight:800;color:#0077c7;">${LEGAL.brand}</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;">${heading}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">${intro}</p>
            ${bodyHtml || ''}
            ${
              ctaUrl
                ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                     <tr><td style="background:#0077c7;border-radius:10px;">
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
          <tr><td style="padding:20px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
            ${LEGAL.brand} · <a href="mailto:${LEGAL.supportEmail}" style="color:#0077c7;">${LEGAL.supportEmail}</a><br/>
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
        <td style="padding:8px 0;font-size:14px;border-bottom:1px solid #eef2f6;">
          ${i.name}<br/><span style="color:#64748b;font-size:13px;">${formatQuantity(i.quantity, i.unit_type)} @ ${formatNaira(i.price)}</span>
        </td>
        <td style="padding:8px 0;font-size:14px;text-align:right;border-bottom:1px solid #eef2f6;white-space:nowrap;">
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
    ${order.shipping_fee != null ? line(order.fulfilment_method === 'pickup' ? 'Pickup' : 'Delivery', deliveryFeeLabel(order)) : ''}
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
  const pickup = order.fulfilment_method === 'pickup'
  // Delivery outside the fixed-price states (031): the fee is still to agree.
  const feeToAgree = isQuoteDelivery(order)
  return {
    subject: `Order #${ref(order)} confirmed — ${LEGAL.brand}`,
    html: layout({
      heading: 'Thanks — your order is confirmed',
      intro: pickup
        ? `We've received your payment for order <strong>#${ref(order)}</strong>. We'll email you again when it's ready to collect.`
        : feeToAgree
          ? `We've received your payment for order <strong>#${ref(order)}</strong>. We'll call or WhatsApp you to agree the delivery fee and how to pay it before we send it.`
          : `We've received your payment for order <strong>#${ref(order)}</strong> and we're getting it ready.`,
      bodyHtml: (pickup ? pickupBlock(order) + codeBlock(order) : '') + itemsTable(order),
      ctaLabel: 'Track your order',
      ctaUrl: url,
      footerNote: order.guest_token
        ? 'Save this email — the link above is the only way to see this order, since it was placed without an account.'
        : 'You can follow your order any time from your account.',
    }),
    text: `Thanks — your order is confirmed

Order #${ref(order)}

${itemsText(order)}

Total: ${formatNaira(order.total_amount)}${feeToAgree ? ' (delivery fee to be agreed)' : ''}
${pickup ? `\n${pickupText(order)}\n` : ''}${feeToAgree ? "\nWe'll call or WhatsApp you to agree the delivery fee and how to pay it before we send your order.\n" : ''}
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
           <p style="margin:0;padding:12px 16px;background:#eef3f8;border-radius:10px;font-family:monospace;font-size:15px;font-weight:600;">${order.tracking_number}</p>`
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

// ---------- Store pickup (028) ----------
//
// Pickup orders reuse shipped/delivered (lib/order-status.js), so these are
// the "shipped" and "delivered" emails in pickup words.

// Where to collect. Inline-styled like every template here.
function pickupBlock(order) {
  const p = order.delivery?.pickup_point
  if (!p) return ''
  const map = pickupMapLink(p)
  const lines = [p.address, [p.city, p.state].filter(Boolean).join(', ')].filter(Boolean)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#eef3f8;border-radius:12px;">
    <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
      <strong>${esc(p.name)}</strong><br/>${lines.map(esc).join('<br/>')}
      ${p.hours ? `<br/><span style="color:#64748b;">Open ${esc(p.hours)}</span>` : ''}
      ${p.phone ? `<br/><a href="tel:${esc(p.phone.replace(/\s+/g, ''))}" style="color:#0077c7;text-decoration:none;">${esc(p.phone)}</a>` : ''}
      ${map ? `<br/><a href="${esc(map)}" style="color:#0077c7;font-weight:600;text-decoration:none;">Open in Google Maps</a>` : ''}
      ${p.instructions ? `<br/><span style="color:#64748b;">${esc(p.instructions)}</span>` : ''}
    </td></tr>
  </table>`
}

function codeBlock(order) {
  if (!order.pickup_code) return ''
  return `<p style="margin:0 0 8px;font-size:14px;color:#475569;">Your pickup code: show it at the store</p>
    <p style="margin:0 0 20px;padding:12px 16px;background:#eef3f8;border-radius:10px;font-size:24px;font-weight:800;letter-spacing:6px;">${esc(order.pickup_code)}</p>`
}

function pickupText(order) {
  const p = order.delivery?.pickup_point
  if (!p) return ''
  return [
    `Collect from: ${p.name}`,
    p.address,
    [p.city, p.state].filter(Boolean).join(', '),
    p.hours ? `Open ${p.hours}` : null,
    p.phone ? `Phone: ${p.phone}` : null,
    order.pickup_code ? `Pickup code: ${order.pickup_code}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function orderReadyForPickupEmail(order) {
  const url = orderUrl(order)
  return {
    subject: `Order #${ref(order)} is ready to collect — ${LEGAL.brand}`,
    html: layout({
      heading: 'Your order is ready to collect',
      intro: `Order <strong>#${ref(order)}</strong> is packed and waiting for you at the store.`,
      bodyHtml: pickupBlock(order) + codeBlock(order),
      ctaLabel: 'View your order',
      ctaUrl: url,
      footerNote: "Sending someone else? Give them the pickup code — we'll hand the order to whoever has it.",
    }),
    text: `Your order is ready to collect

Order #${ref(order)} is packed and waiting for you.

${pickupText(order)}

View: ${url}

Sending someone else? Give them the pickup code.

${LEGAL.brand} · ${LEGAL.supportEmail}`,
  }
}

export function orderCollectedEmail(order) {
  const url = orderUrl(order)
  return {
    subject: `Order #${ref(order)} collected — ${LEGAL.brand}`,
    html: layout({
      heading: 'Collected',
      intro: `Order <strong>#${ref(order)}</strong> has been collected from the store. Thank you for shopping with us.`,
      ctaLabel: 'View your order',
      ctaUrl: url,
      footerNote: "If anything isn't right, just reply to this email and we'll sort it out.",
    }),
    text: `Collected

Order #${ref(order)} has been collected from the store.

View: ${url}

If anything isn't right, reply to this email.

${LEGAL.brand} · ${LEGAL.supportEmail}`,
  }
}

// ---------- Staff alerts ----------
// Everything below goes to the shop, not the customer. The address, name and
// note are whatever the customer typed, so they're escaped: an order must not
// be able to put a link or markup into the staff inbox.
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const lagosTime = (value) =>
  new Date(value || Date.now()).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// contact: { name, email, phone, addressLines } — parsed by the caller from
// the stored address block, so this file stays free of parsing rules.
export function newOrderStaffEmail(order, contact) {
  const url = `${appUrl()}/admin/orders/${order.id}`
  const name = contact.name || order.email || 'A customer'
  const total = formatNaira(order.total_amount)
  const placed = lagosTime(order.created_at)
  const guest = !order.user_id

  const detail = (label, valueHtml) =>
    valueHtml
      ? `<tr>
          <td style="padding:6px 12px 6px 0;font-size:14px;color:#64748b;vertical-align:top;white-space:nowrap;">${label}</td>
          <td style="padding:6px 0;font-size:14px;vertical-align:top;">${valueHtml}</td>
        </tr>`
      : ''

  const phoneHtml = contact.phone
    ? `<a href="tel:${esc(contact.phone.replace(/\s+/g, ''))}" style="color:#0077c7;font-weight:600;text-decoration:none;">${esc(contact.phone)}</a>`
    : ''
  const emailHtml = contact.email
    ? `<a href="mailto:${esc(contact.email)}" style="color:#0077c7;text-decoration:none;">${esc(contact.email)}</a>`
    : ''

  // How it gets to the customer (028).
  const d = order.delivery || null
  const pickup = order.fulfilment_method === 'pickup'
  const map = mapsLink(d?.location)
  const howHtml = !d
    ? ''
    : pickup
      ? `<strong>Store pickup</strong>${d.pickup_point?.name ? ` at ${esc(d.pickup_point.name)}` : ''}${order.pickup_code ? `<br/><span style="color:#64748b;">Pickup code ${esc(order.pickup_code)}</span>` : ''}`
      : [
          `<strong>Delivery</strong>${d.area ? `: ${esc(d.area.name)}, ${esc(d.area.city)}` : d.town ? `: ${esc(d.town)}, ${esc(d.state || '')}` : d.unlisted_city ? `: unlisted area in ${esc(d.unlisted_city)}` : ''}`,
          // Outside the fixed-price states (031) nobody has paid for delivery
          // yet — the one thing staff must do before dispatch.
          isQuoteDelivery(order)
            ? `<strong style="color:#a16207;">Delivery fee to agree</strong> — call or WhatsApp the customer before dispatch`
            : null,
          // Orders from 028 were priced by weight; show it for those.
          d.weight_kg !== undefined && d.weight_kg !== null
            ? `<span style="color:#64748b;">${esc(formatWeight(d.weight_kg))}${d.zone?.name ? ` · ${esc(d.zone.name)}` : ''}</span>`
            : null,
          map ? `<a href="${esc(map)}" style="color:#0077c7;font-weight:600;text-decoration:none;">Customer's location on Google Maps</a>` : null,
        ]
          .filter(Boolean)
          .join('<br/>')

  const customerHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#eef3f8;border-radius:12px;padding:12px 16px;">
    ${detail('Customer', `<strong>${esc(name)}</strong>${guest ? ' <span style="color:#64748b;">(guest checkout)</span>' : ''}`)}
    ${detail('Phone', phoneHtml)}
    ${detail('Email', emailHtml)}
    ${detail('How', howHtml)}
    ${detail(pickup ? 'Collecting' : 'Deliver to', contact.addressLines.length ? contact.addressLines.map(esc).join('<br/>') : '')}
    ${detail('Placed', esc(placed))}
  </table>`

  const noteHtml = order.notes
    ? `<div style="margin:20px 0 0;padding:12px 16px;border-left:3px solid #c49a4a;background:#fbf7ef;font-size:14px;line-height:1.6;">
        <strong>Customer note</strong><br/>${esc(order.notes).replace(/\n/g, '<br/>')}
      </div>`
    : ''

  return {
    subject: `New order #${ref(order)} from ${name}: ${total}`,
    html: layout({
      heading: `New order #${ref(order)}`,
      intro: `<strong>${esc(name)}</strong> placed an order for <strong>${total}</strong>. Payment hasn't been confirmed yet: the order shows as <em>Paid</em> in the admin once Paystack clears it.`,
      bodyHtml: customerHtml + itemsTable(order) + noteHtml,
      ctaLabel: 'Open order in admin',
      ctaUrl: url,
      footerNote: contact.email
        ? 'Sent to shop staff only. Replying to this email writes to the customer.'
        : 'Sent to shop staff only.',
    }),
    text: `New order #${ref(order)}

${name} placed an order for ${total}. Payment not confirmed yet.

Customer: ${name}${guest ? ' (guest checkout)' : ''}
Phone: ${contact.phone || '—'}
Email: ${contact.email || '—'}
${d ? `How: ${pickup ? `Store pickup${d.pickup_point?.name ? ` at ${d.pickup_point.name}` : ''}` : `Delivery${d.area ? ` to ${d.area.name}, ${d.area.city}` : d.town ? ` to ${d.town}, ${d.state || ''}` : ''}${d.weight_kg !== undefined && d.weight_kg !== null ? ` (${formatWeight(d.weight_kg)})` : ''}${isQuoteDelivery(order) ? ' — DELIVERY FEE TO AGREE: call or WhatsApp the customer before dispatch' : ''}`}\n` : ''}${map ? `Location: ${map}\n` : ''}${pickup ? 'Collecting' : 'Deliver to'}:
${contact.addressLines.map((l) => `  ${l}`).join('\n') || '  —'}
Placed: ${placed}

${itemsText(order)}

Total: ${total}
${order.notes ? `\nCustomer note:\n${order.notes}\n` : ''}
Open in admin: ${url}`,
  }
}
