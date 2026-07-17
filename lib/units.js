// Products are sold per piece or per kilogram (the GNX POS model the shop runs
// on). Everything about how a quantity may be typed, stepped and shown lives
// here, so the product page, the cart and the order views can't disagree about
// what "8.7" means.
//
// ⚠️ KG IS CONTINUOUS, NOT A GRID. Feed is weighed out: 0.3 kg, 8.7 kg, 12.25 kg
// are all real orders. An earlier version of this file snapped kg to a 0.5 grid,
// which silently turned a customer's 8.7 into 8.5 — a wrong quantity AND a wrong
// price on a per-kg product, with no error to notice. The step below is only the
// size of a ± nudge; it is NOT a constraint on what may be typed.

export const KG_STEP = 0.5 // how much ± moves — a convenience, not a rule
export const PIECE_STEP = 1

// 100g. Below this it isn't a sale, it's a typo — and the scale can't honour it.
export const KG_MIN = 0.1

// 3dp, matching the server: /api/checkout/create-order does
// Math.round(quantity * 1000) / 1000. Any more precision is a lie about the
// scale; any less would reject weights the shop genuinely sells.
export const KG_DECIMALS = 3

export const isKg = (unitType) => unitType === 'kg'

export const stepFor = (unitType) => (isKg(unitType) ? KG_STEP : PIECE_STEP)

export const minQuantityFor = (unitType) => (isKg(unitType) ? KG_MIN : PIECE_STEP)

// Float arithmetic makes 0.1 + 0.2 = 0.30000000000000004, and repeated += 0.5
// drifts. Every quantity goes through here.
export const roundQuantity = (value) => Math.round(Number(value) * 1000) / 1000

// Make a typed value storable.
//
// kg   → rounded to 3dp and floored at KG_MIN. NOT snapped: 8.7 stays 8.7.
// piece → rounded to a whole number, which is what create-order enforces (it
//         rejects a fractional quantity on a per-piece product).
export function normalizeQuantity(value, unitType) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return minQuantityFor(unitType)

  if (isKg(unitType)) {
    return Math.max(roundQuantity(n), KG_MIN)
  }
  return Math.max(Math.round(n), PIECE_STEP)
}

// "8.7 kg" / "3" — trailing zeros dropped, so a whole kg reads "2 kg" not
// "2.000 kg".
export function formatQuantity(quantity, unitType) {
  const n = roundQuantity(quantity)
  return isKg(unitType) ? `${n} kg` : String(n)
}
