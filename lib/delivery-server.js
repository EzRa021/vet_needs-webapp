import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { bandLabel, formatWeight, orderWeight } from '@/lib/delivery'

// Server-side delivery pricing (028). The checkout quote and create-order both
// call quoteDelivery(), so the number a shopper sees is the number they're
// charged. The browser's copy of a quote is never trusted.

const PICKUP_COLUMNS = 'id, name, address, city, state, phone, hours, map_url, instructions, fee'

const contactLine = (phone) =>
  phone ? `Call us on ${phone} to arrange it` : 'Contact us to arrange it'

// lines: catalogue rows [{ name, quantity, unit_type, weight_grams }] — read
// from the database by the caller, never taken from the request.
//
// Returns:
//   ok        true when the order can be charged online at `fee`
//   reason    what to tell the customer when ok is false
//   fee, freeOver, weightKg, missingWeight, zone, area, band, matchedBy,
//   estimate, pickupPoint
export async function quoteDelivery({
  method = 'delivery',
  pickupPointId = null,
  state = null,
  areaId = null,
  unlistedCity = null,
  city = null, // the town typed on the address, for the state path
  lines = [],
}) {
  const settings = await getSettings()
  const weight = orderWeight(lines)
  const base = {
    ok: false,
    reason: null,
    method: method === 'pickup' ? 'pickup' : 'delivery',
    fee: null,
    freeOver: null,
    weightKg: weight.kg,
    missingWeight: weight.missing,
    zone: null,
    area: null,
    band: null,
    matchedBy: null,
    estimate: null,
    pickupPoint: null,
  }
  const supabase = await createClient()

  if (base.method === 'pickup') {
    if (!pickupPointId) {
      return { ...base, reason: 'Choose where you’ll collect your order.' }
    }
    const { data: point, error } = await supabase
      .from('pickup_points')
      .select(PICKUP_COLUMNS)
      .eq('id', pickupPointId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (!point) {
      return {
        ...base,
        reason: 'That pickup point isn’t available any more. Choose another, or switch to delivery.',
      }
    }
    // A pickup fee is a handling charge, so no free-delivery threshold applies.
    return { ...base, ok: true, fee: Number(point.fee) || 0, pickupPoint: point }
  }

  // Areas only count while area pricing is switched on. Off, every delivery
  // is priced by state exactly as before 028.
  const areaPricing = settings.area_pricing_enabled === true
  const pAreaId = areaPricing && areaId ? areaId : null
  let pCity = areaPricing && !pAreaId && unlistedCity ? String(unlistedCity).slice(0, 80) : null

  // "Somewhere else in the state" is for towns outside the priced cities. A
  // customer who chooses it and then types one of those cities ("Ibadan") is
  // priced as that city's unlisted area — otherwise the state price, often the
  // cheaper one, would be one click away for everyone in Ibadan.
  const typedCity = typeof city === 'string' ? city.trim().slice(0, 80) : ''
  let cityFromTyping = false
  if (areaPricing && !pAreaId && !pCity && typedCity) {
    const { data: cityZone, error: cityError } = await supabase
      .from('shipping_zones')
      .select('id')
      .ilike('city', typedCity.replace(/[%_\\]/g, ''))
      .eq('is_active', true)
      .limit(1)
    if (cityError) throw cityError
    if (cityZone?.length) {
      pCity = typedCity
      cityFromTyping = true
    }
  }

  const { data, error } = await supabase.rpc('resolve_delivery', {
    p_state: state ? String(state).slice(0, 60) : null,
    p_city: pCity,
    p_area_id: pAreaId,
    p_weight_kg: weight.kg,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data

  if (!row) {
    if (cityFromTyping) {
      return {
        ...base,
        reason: `We deliver in ${typedCity} by area. Choose your area from the list, or collect from our store.`,
      }
    }
    if (pAreaId || pCity) {
      return {
        ...base,
        reason: 'We don’t deliver to that area online yet. Choose another area, or collect from our store.',
      }
    }
    // No state zone and no catch-all: the flat fee in Settings, as 014 did.
    // A state delivery must always have a price.
    return {
      ...base,
      ok: true,
      fee: settings.shipping_flat_fee,
      freeOver: settings.free_shipping_threshold,
      matchedBy: 'flat',
    }
  }

  const band = row.band_id
    ? {
        from_kg: Number(row.band_from_kg) || 0,
        up_to_kg: row.band_up_to_kg === null ? null : Number(row.band_up_to_kg),
      }
    : null

  const result = {
    ...base,
    zone: { id: row.zone_id, name: row.zone_name, city: row.zone_city },
    area: row.area_id
      ? { id: row.area_id, name: row.area_name, city: row.area_city, state: row.area_state }
      : null,
    band: band ? { ...band, label: bandLabel(band) } : null,
    matchedBy: row.matched_by,
    estimate: row.delivery_estimate,
    freeOver: row.free_over === null || row.free_over === undefined ? null : Number(row.free_over),
  }

  if ((row.fee === null || row.fee === undefined) && cityFromTyping) {
    return {
      ...result,
      reason: `We deliver in ${typedCity} by area. Choose your area from the list, or collect from our store.`,
    }
  }
  if (row.fee === null || row.fee === undefined) {
    return {
      ...result,
      reason: `We can’t price delivery for ${formatWeight(weight.kg)} here online. ${contactLine(
        settings.support_phone
      )}, or collect from our store.`,
    }
  }

  return { ...result, ok: true, fee: Number(row.fee) }
}

// What the checkout needs to draw its delivery choices: the pickup points,
// and — while area pricing is on — the areas customers can pick, grouped by
// city. An area is offered only if its zone is active AND priced, so a zone
// staff haven't filled in yet can't quote anyone ₦0.
export async function loadDeliveryOptions() {
  const settings = await getSettings()
  const areaPricing = settings.area_pricing_enabled === true
  const supabase = await createClient()

  const pointsQuery = supabase
    .from('pickup_points')
    .select(PICKUP_COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!areaPricing) {
    const { data: points, error } = await pointsQuery
    if (error) throw error
    return { areaPricing, cities: [], pickupPoints: points || [], supportPhone: settings.support_phone }
  }

  const [pointsRes, zonesRes, ratesRes, areasRes] = await Promise.all([
    pointsQuery,
    supabase
      .from('shipping_zones')
      .select('id, city, fee, is_city_fallback')
      .eq('is_active', true)
      .not('city', 'is', null),
    supabase.from('shipping_zone_rates').select('zone_id'),
    supabase
      .from('delivery_areas')
      .select('id, name, aliases, city, state, zone_id')
      .eq('is_active', true)
      .not('zone_id', 'is', null)
      .order('name', { ascending: true }),
  ])
  for (const res of [pointsRes, zonesRes, ratesRes, areasRes]) {
    if (res.error) throw res.error
  }

  const banded = new Set((ratesRes.data || []).map((r) => r.zone_id))
  const priced = new Map(
    (zonesRes.data || [])
      .filter((z) => banded.has(z.id) || z.fee !== null)
      .map((z) => [z.id, z])
  )

  const byCity = new Map()
  for (const area of areasRes.data || []) {
    if (!priced.has(area.zone_id)) continue
    const key = `${area.city.toLowerCase()}|${area.state.toLowerCase()}`
    if (!byCity.has(key)) {
      byCity.set(key, { city: area.city, state: area.state, hasFallback: false, areas: [] })
    }
    byCity.get(key).areas.push({ id: area.id, name: area.name, aliases: area.aliases || [] })
  }
  for (const zone of priced.values()) {
    if (!zone.is_city_fallback) continue
    for (const entry of byCity.values()) {
      if (entry.city.toLowerCase() === zone.city.toLowerCase()) entry.hasFallback = true
    }
  }

  return {
    areaPricing,
    cities: [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city)),
    pickupPoints: pointsRes.data || [],
    supportPhone: settings.support_phone,
  }
}

// The browser's view of a quote: no zone ids, nothing it doesn't display.
export function publicQuote(q) {
  return {
    ok: q.ok,
    reason: q.reason,
    method: q.method,
    fee: q.fee,
    free_over: q.freeOver,
    weight_kg: q.weightKg,
    zone_name: q.zone?.name || null,
    area_name: q.area?.name || null,
    city: q.area?.city || q.zone?.city || null,
    band_label: q.band?.label || null,
    estimate: q.estimate,
    matched_by: q.matchedBy,
    pickup_point: q.pickupPoint
      ? {
          id: q.pickupPoint.id,
          name: q.pickupPoint.name,
          address: q.pickupPoint.address,
          city: q.pickupPoint.city,
          hours: q.pickupPoint.hours,
        }
      : null,
  }
}
