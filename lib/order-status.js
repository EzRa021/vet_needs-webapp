// Single source of truth for how order statuses look and read, so the admin
// list, the admin detail page and the customer's order history never drift.
export const ORDER_STATUS = {
  pending: {
    label: 'Awaiting payment',
    variant: 'outline',
    description: "The customer started checkout but Paystack hasn't confirmed payment.",
    customerUpdate: "We're waiting for your payment to be confirmed.",
  },
  paid: {
    label: 'Paid',
    variant: 'default',
    description: 'Payment confirmed. Ready to be packed.',
    customerUpdate: 'Payment confirmed. We’ll start packing your order shortly.',
  },
  processing: {
    label: 'Processing',
    variant: 'secondary',
    description: 'Being picked and packed.',
    customerUpdate: 'Your order is being picked and packed.',
  },
  shipped: {
    label: 'Shipped',
    variant: 'secondary',
    description: 'On its way to the customer.',
    customerUpdate: 'Your order is on its way.',
  },
  delivered: {
    label: 'Delivered',
    variant: 'default',
    description: 'Received by the customer.',
    customerUpdate: 'Your order has been delivered.',
  },
  canceled: {
    label: 'Canceled',
    variant: 'destructive',
    description: 'This order will not be fulfilled.',
    customerUpdate: 'This order was canceled.',
  },
  refunded: {
    label: 'Refunded',
    variant: 'destructive',
    description: 'Payment returned to the customer.',
    customerUpdate: 'Your payment has been refunded.',
  },
}

export const ORDER_STATUSES = Object.keys(ORDER_STATUS)

export const statusMeta = (status) =>
  ORDER_STATUS[status] || { label: status, variant: 'secondary', description: '', customerUpdate: '' }

// The happy-path journey, used to draw the progress timeline.
export const FULFILMENT_FLOW = ['pending', 'paid', 'processing', 'shipped', 'delivered']

export const isTerminal = (status) => status === 'canceled' || status === 'refunded'

// 0..1 along the happy path; terminal statuses report null (no progress bar).
export const fulfilmentProgress = (status) => {
  if (isTerminal(status)) return null
  const i = FULFILMENT_FLOW.indexOf(status)
  return i < 0 ? 0 : i / (FULFILMENT_FLOW.length - 1)
}

// Statuses staff may set by hand, and from where. The API route enforces
// these; the UI reads the same table so it never offers a move the server
// will refuse.
//
// 'paid' is absent: only the Paystack webhook / verify flow may mark an order
// paid (mark_order_paid), because that also decrements stock atomically.
// 'refunded' is absent: only the refund webhook (016) may write it — the
// status records that money moved; it does not express an intention to.
export const SETTABLE_STATUSES = ['processing', 'shipped', 'delivered', 'canceled']

export const ALLOWED_TRANSITIONS = {
  pending: ['canceled'],
  paid: ['processing', 'shipped', 'delivered', 'canceled'],
  processing: ['shipped', 'delivered', 'canceled'],
  shipped: ['delivered'],
  delivered: [],
  canceled: [],
  refunded: [],
}

export const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from] || []).includes(to)

// Statuses that mean the money has arrived (used for revenue figures).
export const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered']

// "#1A2B3C4D" — how an order is referred to everywhere a person reads it.
export const orderRef = (id) => `#${String(id || '').slice(0, 8).toUpperCase()}`

// create-order writes the address as a fixed block of lines:
//   First Last
//   Street
//   [Street 2]
//   City, State [Zip]
//   Country
//   Email: …
//   Phone: …
// Pull the useful parts back out for the table. Anything unexpected falls
// back to nulls rather than guessing.
export function parseShippingAddress(text) {
  const empty = { name: null, email: null, phone: null, city: null, state: null, lines: [] }
  if (!text) return empty
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return empty

  const out = { ...empty, lines: [] }
  for (const line of lines) {
    const email = line.match(/^email:\s*(.+)$/i)
    const phone = line.match(/^phone:\s*(.+)$/i)
    if (email) out.email = email[1] === 'undefined' ? null : email[1]
    else if (phone) out.phone = phone[1] === 'undefined' ? null : phone[1]
    else out.lines.push(line)
  }
  out.name = out.lines[0] || null

  // "City, State 100001" — the last line with a comma before the country line.
  const cityLine = [...out.lines].reverse().find((l, i) => i > 0 && l.includes(','))
  if (cityLine) {
    const [city, rest] = cityLine.split(',').map((s) => s.trim())
    out.city = city || null
    out.state = rest ? rest.replace(/\s+\d{4,}$/, '').trim() || null : null
  }
  return out
}
