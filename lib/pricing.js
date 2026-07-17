// Single source of truth for money rules — used by BOTH the client (display)
// and the server (authoritative calculation). Currency is NGN.
//
// VAT follows the GNX POS model, PER ITEM:
//   vat_enabled   — whether the item is taxed at all
//   vat_rate      — percent, e.g. 7.5
//   vat_inclusive — true  = price already CONTAINS VAT (nothing added at checkout;
//                            we only report the included portion)
//                   false = VAT is ADDED on top at checkout
// Items missing these fields (old carts) fall back to the defaults below,
// which match the items table defaults: enabled, 7.5%, inclusive.

export const CURRENCY = 'NGN'
// Fallbacks only. The real values come from the `settings` table via
// lib/settings.js on the server, and /api/shop/settings on the client. These
// are used when settings can't be read, so checkout never breaks.
export const SHIPPING_FLAT = 1500 // ₦ flat shipping fee (until shipping zones exist)
export const DEFAULT_VAT_RATE = 7.5 // percent — matches items.vat_rate default

const round2 = (n) => Math.round(n * 100) / 100

// items: [{ price, quantity, vat_enabled?, vat_rate?, vat_inclusive? }]
// opts:
//   discount         — NGN off the subtotal. On the server this always comes
//                      from validate_coupon(); a client value is never trusted.
//   shippingFlat     — from settings.shipping_flat_fee
//   freeShippingOver — from settings.free_shipping_threshold (null = disabled)
export function calcTotals(
  items,
  { discount = 0, shippingFlat = SHIPPING_FLAT, freeShippingOver = null } = {}
) {
  let subtotal = 0
  let addedTax = 0 // VAT charged on top (vat_inclusive = false)
  let includedTax = 0 // VAT already inside the prices (informational)

  for (const i of items) {
    const line = i.price * i.quantity
    subtotal += line

    const enabled = i.vat_enabled ?? true
    const rate = (Number(i.vat_rate ?? DEFAULT_VAT_RATE) || 0) / 100
    if (!enabled || rate <= 0) continue

    if (i.vat_inclusive ?? true) {
      includedTax += line * (rate / (1 + rate)) // back out the VAT portion
    } else {
      addedTax += line * rate
    }
  }

  // Never discount more than the goods are worth (total can't go negative).
  const appliedDiscount = round2(Math.min(Math.max(Number(discount) || 0, 0), subtotal))

  // Free shipping is judged on what the customer actually pays for goods
  // (after any coupon), so a discount code can't be used to unlock free
  // delivery the order didn't really qualify for.
  const goodsTotal = round2(subtotal - appliedDiscount)
  const flat = Number(shippingFlat) >= 0 ? Number(shippingFlat) : SHIPPING_FLAT
  const threshold =
    freeShippingOver === null || freeShippingOver === undefined
      ? null
      : Number(freeShippingOver)

  const qualifiesFree = threshold !== null && threshold > 0 && goodsTotal >= threshold
  const shipping = subtotal > 0 && !qualifiesFree ? flat : 0

  const tax = round2(addedTax)
  const total = round2(goodsTotal + shipping + tax)

  return {
    subtotal: round2(subtotal),
    discount: appliedDiscount,
    shipping,
    tax, // only the VAT added on top — this is part of total
    includedTax: round2(includedTax), // shown as "VAT included", NOT added to total
    total,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    // Free-shipping progress, for the cart nudge
    freeShipping: {
      enabled: threshold !== null && threshold > 0,
      threshold,
      qualifies: qualifiesFree,
      remaining:
        threshold !== null && threshold > 0 && !qualifiesFree
          ? round2(threshold - goodsTotal)
          : 0,
    },
  }
}

export function formatNaira(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount ?? 0)
}

// Display helper: "₦3,200.00 / kg" for weight items, plain price for pieces
export function formatUnitPrice(price, unitType) {
  return unitType === 'kg' ? `${formatNaira(price)} / kg` : formatNaira(price)
}
