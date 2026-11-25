// Delivery helpers shared by the browser and the server (028/029). Pure
// functions only: nothing here reads the database. Pricing lives in
// lib/delivery-server.js.

import { formatNaira } from '@/lib/pricing'

export const FULFILMENT_METHODS = ['delivery', 'pickup']

// How door delivery is priced in a state (031):
//   fixed  the chosen area's price, paid at checkout (Oyo/Ibadan)
//   quote  agreed with the customer by call or WhatsApp after the order
export const PRICING_MODES = ['fixed', 'quote']

// A delivery order whose fee is still to be agreed with the customer.
export const isQuoteDelivery = (order) =>
  order?.fulfilment_method !== 'pickup' && order?.delivery?.pricing === 'quote'

// What an order's delivery line says, everywhere it's shown. A quote order
// carries shipping_fee 0 until staff agree the fee — it must never read
// "Free", which is a promise the shop hasn't made.
export function deliveryFeeLabel(order) {
  if (isQuoteDelivery(order)) return 'To be agreed'
  const fee = Number(order?.shipping_fee)
  if (!Number.isFinite(fee)) return null
  return fee === 0 ? 'Free' : formatNaira(fee)
}

// A Nigerian phone number as wa.me wants it: "0803 123 4567" or
// "+234 803 123 4567" → "2348031234567". Null when it doesn't look like one.
export function waDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('0') && d.length === 11) d = `234${d.slice(1)}`
  return d.length >= 10 && d.length <= 15 ? d : null
}

// The shop's own number, or null while it's empty or still a placeholder like
// "0800 000 0000" — showing that as "call us" sends customers nowhere.
export function realPhoneDigits(phone) {
  const d = waDigits(phone)
  if (!d) return null
  const national = d.startsWith('234') ? d.slice(3) : d
  return /^[1-9]0+$/.test(national) || /^(\d)\1+$/.test(national) ? null : d
}

// Staff's link to message a customer on WhatsApp about their order.
export function customerWhatsappLink(phone, message) {
  const d = waDigits(phone)
  if (!d) return null
  return message ? `https://wa.me/${d}?text=${encodeURIComponent(message)}` : `https://wa.me/${d}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v) => typeof v === 'string' && UUID.test(v)

// "52.5 kg", "800 g". Only orders placed before 029 (weight pricing) carry a
// weight; their order pages and emails still show it. Tabular figures are the
// caller's job.
export function formatWeight(kg) {
  const n = Number(kg) || 0
  if (n > 0 && n < 1) return `${Math.round(n * 1000)} g`
  return `${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 }).format(n)} kg`
}

// A Google Maps link for a GPS point — orders placed before 029 could carry
// the customer's location. A plain URL: no API key, no cost, and it opens the
// Maps app on a rider's phone.
export function mapsLink(location) {
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
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
