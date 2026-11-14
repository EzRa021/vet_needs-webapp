// Delivery helpers shared by the browser and the server (028). Pure functions
// only: nothing here reads the database. The server-side resolver that does
// lives in lib/delivery-server.js.

export const FULFILMENT_METHODS = ['delivery', 'pickup']

// The checkout area picker stores ONE string for the customer's choice, so a
// half-made choice (an area id AND an "isn't listed" city) can't exist:
//   "area:<uuid>"   a listed area
//   "city:<City>"   "my area in <City> isn't listed" → the city's fallback zone
//   "state"         somewhere in the state outside the priced cities
//   ""              not chosen yet
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v) => typeof v === 'string' && UUID.test(v)

export function parseAreaKey(key) {
  const k = String(key || '').slice(0, 120)
  if (k.startsWith('area:')) {
    const id = k.slice(5)
    return { areaId: isUuid(id) ? id : null, unlistedCity: null }
  }
  if (k.startsWith('city:')) return { areaId: null, unlistedCity: k.slice(5).trim() || null }
  return { areaId: null, unlistedCity: null }
}

const round3 = (n) => Math.round(n * 1000) / 1000

// Order weight in kg, from catalogue rows:
//   [{ name, quantity, unit_type, weight_grams }]
// A kg item weighs its quantity. A piece item weighs weight_grams × quantity.
// Pieces with no weight are counted as 0 and NAMED in `missing`, so staff can
// see an order was priced light rather than the weight being quietly guessed.
export function orderWeight(lines) {
  let kg = 0
  const missing = []
  for (const line of lines || []) {
    const quantity = Number(line.quantity) || 0
    if (quantity <= 0) continue
    if (line.unit_type === 'kg') {
      kg += quantity
      continue
    }
    const grams = Number(line.weight_grams)
    if (Number.isFinite(grams) && grams > 0) kg += (grams / 1000) * quantity
    else missing.push(line.name || 'Unnamed item')
  }
  return { kg: round3(kg), missing }
}

// "52.5 kg", "800 g". Tabular figures are the caller's job.
export function formatWeight(kg) {
  const n = Number(kg) || 0
  if (n > 0 && n < 1) return `${Math.round(n * 1000)} g`
  return `${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 }).format(n)} kg`
}

const kgText = (n) => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 }).format(Number(n))

// A band is (previous limit, up_to_kg]. The first band starts at 0; the last
// has no upper limit.
//   { from_kg: 0,   up_to_kg: 10 }   → "Up to 10 kg"
//   { from_kg: 10,  up_to_kg: 50 }   → "10–50 kg"
//   { from_kg: 150, up_to_kg: null } → "Over 150 kg"
export function bandLabel(band) {
  if (!band) return ''
  const from = Number(band.from_kg) || 0
  const upTo = band.up_to_kg === null || band.up_to_kg === undefined ? null : Number(band.up_to_kg)
  if (upTo === null) return from > 0 ? `Over ${kgText(from)} kg` : 'Any weight'
  if (from <= 0) return `Up to ${kgText(upTo)} kg`
  return `${kgText(from)}–${kgText(upTo)} kg`
}

// Adds from_kg to a list of bands sorted by up_to_kg (null last).
export function withBandRanges(bands) {
  const sorted = [...(bands || [])].sort((a, b) => {
    if (a.up_to_kg === null) return 1
    if (b.up_to_kg === null) return -1
    return Number(a.up_to_kg) - Number(b.up_to_kg)
  })
  let previous = 0
  return sorted.map((b) => {
    const band = { ...b, from_kg: previous }
    if (b.up_to_kg !== null) previous = Number(b.up_to_kg)
    return band
  })
}

// A Google Maps link for a GPS point. A plain URL: no API key, no cost, and it
// opens the Maps app on a rider's phone.
export function mapsLink(location) {
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
}

// Validates a browser-supplied GPS point. Nigeria spans roughly 4–14°N and
// 2–15°E; anything outside is a spoofed or broken reading, not an address.
export function cleanLocation(raw) {
  if (!raw || typeof raw !== 'object') return null
  const lat = Number(raw.lat)
  const lng = Number(raw.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 3 || lat > 15 || lng < 2 || lng > 16) return null
  const accuracy = Number(raw.accuracy)
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    accuracy_m: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
  }
}

// Six digits, shown to the customer and checked by staff at collection.
export function newPickupCode() {
  const bytes = new Uint32Array(1)
  globalThis.crypto.getRandomValues(bytes)
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}

// A map link for a pickup point: the shop's own Google Maps link if they
// pasted one, otherwise a search for the address.
export function pickupMapLink(point) {
  if (!point) return null
  if (point.map_url && /^https:\/\//i.test(point.map_url)) return point.map_url
  const where = [point.address, point.city, point.state].filter(Boolean).join(', ')
  return where ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}` : null
}

// The pickup code only means something between payment and collection:
// before payment there's nothing to collect, and afterwards it's spent.
export function pickupCodeVisible(order) {
  return Boolean(
    order?.fulfilment_method === 'pickup' &&
      order.pickup_code &&
      ['paid', 'processing', 'shipped'].includes(order.status)
  )
}
