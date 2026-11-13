import { formatNaira } from '@/lib/pricing'
import { formatQuantity } from '@/lib/units'

// How stock is talked about across the admin: item_history rows (written by
// log_item_changes()), the reasons adjust_stock() records (021), and the
// level a product is at. One place, so the Products table, the Inventory
// feed and a product's own history never disagree.

export const STOCK_TYPES = ['sale', 'restock', 'adjustment']

// Reason codes written by adjust_stock() (021). Rendering the raw slug would
// make the whole feature look half-built the first time someone spoils a bag.
export const REASON_LABEL = {
  restock: 'Delivery from supplier',
  return: 'Customer return',
  count_correction: 'Stock count correction',
  damaged: 'Damaged',
  expired: 'Expired / spoiled',
  offline_sale: 'Sold offline',
  sample: 'Sample or giveaway',
  theft: 'Loss / theft',
  other: 'Other',
}

export const MOVEMENT_LABEL = {
  creation: 'Added to catalogue',
  sale: 'Sold',
  restock: 'Restocked',
  adjustment: 'Adjusted',
  price_update: 'Price changed',
  vat_update: 'VAT changed',
}

// Where a product's stock sits relative to its reorder point.
//   out       0 or less (still buyable if backorders are on)
//   low       at or below low_stock_threshold
//   ok        above it
export function stockLevel(item) {
  if (item?.stock === null || item?.stock === undefined) return 'untracked'
  const stock = Number(item.stock)
  const threshold = Number(item.low_stock_threshold ?? item.threshold ?? 10)
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'ok'
}

export const STOCK_LEVEL_LABEL = {
  out: 'Out of stock',
  low: 'Low stock',
  ok: 'In stock',
  untracked: 'Not tracked',
}

// Price without VAT, so margins compare like with like. A VAT-inclusive price
// carries the tax inside it; counting that as margin overstates profit.
export function netPrice(item) {
  const price = Number(item?.price ?? 0)
  if (item?.vat_enabled && item?.vat_inclusive) {
    return price / (1 + Number(item.vat_rate ?? 0) / 100)
  }
  return price
}

// { amount, percent } of the net price, or null when cost isn't known.
export function margin(item) {
  const cost = item?.cost_price ?? item?.cost
  if (cost === null || cost === undefined) return null
  const net = netPrice(item)
  const amount = net - Number(cost)
  return { amount, percent: net > 0 ? (amount / net) * 100 : 0 }
}

// One line describing an item_history row, for feeds and histories.
export function describeMovement(entry) {
  const d = entry?.details || {}
  switch (entry?.type) {
    case 'creation':
      return `Added with ${formatQuantity(d.initialStock ?? 0, d.unitType)} in stock at ${formatNaira(d.price)}`
    case 'sale':
    case 'restock':
    case 'adjustment': {
      const change = Number(d.changeAmount ?? 0)
      const qty = formatQuantity(Math.abs(change), d.unitType)
      const verb = entry.type === 'sale' ? 'Sold' : change > 0 ? 'Added' : 'Removed'
      const reason = d.reason ? `, ${REASON_LABEL[d.reason] || d.reason}` : ''
      return `${verb} ${qty} (${formatQuantity(d.previousValue ?? 0, d.unitType)} to ${formatQuantity(d.newValue ?? 0, d.unitType)})${reason}`
    }
    case 'price_update':
      return d.previousPrice !== d.newPrice
        ? `Price ${formatNaira(d.previousPrice)} to ${formatNaira(d.newPrice)}`
        : 'Cost or compare-at price updated'
    case 'vat_update':
      return d.previousVatEnabled !== d.newVatEnabled
        ? d.newVatEnabled
          ? 'VAT turned on'
          : 'VAT turned off'
        : `VAT rate ${d.previousVatRate}% to ${d.newVatRate}%`
    default:
      return 'Updated'
  }
}
