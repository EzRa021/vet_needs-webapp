// Shared coupon logic — used by the admin UI and (once wired) checkout, so the
// two can never disagree about whether a code is usable.
import { formatNaira } from '@/lib/pricing'

// Derived lifecycle state. Order matters: a disabled coupon is "disabled" even
// if it has also expired.
export function couponStatus(c) {
  const now = Date.now()
  if (!c.is_active) return 'disabled'
  if (c.expires_at && new Date(c.expires_at).getTime() < now) return 'expired'
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return 'scheduled'
  if (c.max_uses != null && Number(c.used_count) >= Number(c.max_uses)) return 'used_up'
  return 'active'
}

export const COUPON_STATUS_META = {
  active: { label: 'Active', variant: 'default', description: 'Customers can use this code now.' },
  scheduled: { label: 'Scheduled', variant: 'secondary', description: "Starts later — not usable yet." },
  expired: { label: 'Expired', variant: 'outline', description: 'Past its end date.' },
  used_up: { label: 'Used up', variant: 'outline', description: 'Hit its total usage limit.' },
  disabled: { label: 'Disabled', variant: 'destructive', description: 'Switched off by an admin.' },
}

export const statusMetaFor = (c) => COUPON_STATUS_META[couponStatus(c)]

// Plain-language summary, e.g.
// "10% off orders over ₦5,000 (max ₦2,000 off)"
export function describeCoupon(c) {
  const value =
    c.discount_type === 'percent'
      ? `${Number(c.discount_value)}% off`
      : `${formatNaira(c.discount_value)} off`

  const parts = [value]
  if (Number(c.min_order_amount) > 0) {
    parts.push(`orders over ${formatNaira(c.min_order_amount)}`)
  }
  let text = parts.join(' ')
  if (c.discount_type === 'percent' && c.max_discount_amount) {
    text += ` (max ${formatNaira(c.max_discount_amount)} off)`
  }
  return text
}

// The authoritative discount calculation. Kept here so checkout and the admin
// preview always produce the same number.
export function calcDiscount(coupon, subtotal) {
  if (Number(subtotal) < Number(coupon.min_order_amount || 0)) return 0
  let discount =
    coupon.discount_type === 'percent'
      ? (Number(subtotal) * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value)

  if (coupon.discount_type === 'percent' && coupon.max_discount_amount) {
    discount = Math.min(discount, Number(coupon.max_discount_amount))
  }
  // Never discount more than the order is worth.
  discount = Math.min(discount, Number(subtotal))
  return Math.round(discount * 100) / 100
}
