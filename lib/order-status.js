// Single source of truth for how order statuses look and read, so the admin
// list, the admin detail page and the customer's order history never drift.
export const ORDER_STATUS = {
  pending: {
    label: 'Awaiting payment',
    variant: 'outline',
    description: "The customer started checkout but Paystack hasn't confirmed payment.",
  },
  paid: {
    label: 'Paid',
    variant: 'default',
    description: 'Payment confirmed. Ready to be packed.',
  },
  processing: {
    label: 'Processing',
    variant: 'secondary',
    description: 'Being picked and packed.',
  },
  shipped: {
    label: 'Shipped',
    variant: 'secondary',
    description: 'On its way to the customer.',
  },
  delivered: {
    label: 'Delivered',
    variant: 'default',
    description: 'Received by the customer.',
  },
  canceled: {
    label: 'Canceled',
    variant: 'destructive',
    description: 'This order will not be fulfilled.',
  },
  refunded: {
    label: 'Refunded',
    variant: 'destructive',
    description: 'Payment returned to the customer.',
  },
}

export const statusMeta = (status) =>
  ORDER_STATUS[status] || { label: status, variant: 'secondary', description: '' }

// The happy-path journey, used to draw the progress timeline.
export const FULFILMENT_FLOW = ['pending', 'paid', 'processing', 'shipped', 'delivered']

export const isTerminal = (status) => status === 'canceled' || status === 'refunded'
