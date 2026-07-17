// Products are sold per piece or per kilogram (see the GNX POS model the shop
// runs on). Everything about how a quantity may be typed, stepped and shown
// lives here, so the product page, the cart and the order views can't disagree
// about what "2.5" means.

export const KG_STEP = 0.5   // half-bags/scoops are how feed is actually bought
export const PIECE_STEP = 1

export const isKg = (unitType) => unitType === 'kg'

export const stepFor = (unitType) => (isKg(unitType) ? KG_STEP : PIECE_STEP)

// The smallest sellable amount. Also the floor for the − button.
export const minQuantityFor = (unitType) => stepFor(unitType)

// Float arithmetic makes 0.1 + 0.2 = 0.30000000000000004, and repeated += 0.5
// drifts. Every quantity goes through here, matching the 3dp rounding
// /api/checkout/create-order applies server-side.
export const roundQuantity = (value) => Math.round(Number(value) * 1000) / 1000

// Snap an arbitrary (typed) value onto the step grid, e.g. 2.3 kg → 2.5 kg.
// Piece items snap to whole numbers, which is what create-order enforces:
// it rejects a fractional quantity on a per-piece product.
export function snapToStep(value, unitType) {
  const step = stepFor(unitType)
  const n = Number(value)
  if (!Number.isFinite(n)) return minQuantityFor(unitType)
  return roundQuantity(Math.round(n / step) * step)
}

// "2.5 kg" / "3" — trailing zeros dropped, so a whole kg reads "2 kg" not
// "2.0 kg".
export function formatQuantity(quantity, unitType) {
  const n = roundQuantity(quantity)
  return isKg(unitType) ? `${n} kg` : String(n)
}
