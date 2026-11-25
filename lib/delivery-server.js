import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'

// Server-side delivery (029). The checkout quote and create-order both call
// quoteDelivery(), so the number a customer sees is the number they're
// charged. The browser's copy of a quote is never trusted.
//
// The model, as the shop runs it:
//   * The customer chooses their AREA (Ibadan only). It's compulsory for both
//     ways of getting the order.
//   * Door delivery costs that area's price. An area with no price has no
//     door delivery — its customers collect instead.
//   * Pickup is from the store the area is assigned to (its nearest). An area
//     staff haven't assigned yet lets the customer choose the store.
//   * Either way can be switched off shop-wide (settings), and is then refused
//     here as well as hidden at checkout.

const STORE_COLUMNS = 'id, name, address, city, state, phone, hours, map_url, instructions, fee'
const AREA_COLUMNS = 'id, name, city, state, delivery_fee, pickup_point_id'

const money = (v) => (v === null || v === undefined ? null : Number(v))

// Returns:
//   ok           true when the order can be charged online at `fee`
//   reason       what to tell the customer when ok is false
//   method, fee, freeOver, area, pickupPoint
export async function quoteDelivery({ method = 'delivery', areaId = null, pickupPointId = null }) {
  const settings = await getSettings()
  const base = {
    ok: false,
    reason: null,
    method: method === 'pickup' ? 'pickup' : 'delivery',
    fee: null,
    freeOver: null,
    area: null,
    pickupPoint: null,
  }

  if (base.method === 'delivery' && !settings.doorstep_delivery_enabled) {
    return { ...base, reason: 'Delivery to your door isn’t available right now. Collect from our store instead.' }
  }
  if (base.method === 'pickup' && !settings.store_pickup_enabled) {
    return { ...base, reason: 'Store pickup isn’t available right now. Choose delivery to your door instead.' }
  }

  if (!areaId) return { ...base, reason: 'Choose your area.' }

  const supabase = await createClient()
  const { data: area, error } = await supabase
    .from('delivery_areas')
    .select(AREA_COLUMNS)
    .eq('id', areaId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!area) return { ...base, reason: 'That area isn’t on our list any more. Choose your area again.' }

  const withArea = {
    ...base,
    area: { id: area.id, name: area.name, city: area.city, state: area.state },
  }

  if (base.method === 'delivery') {
    const fee = money(area.delivery_fee)
    if (fee === null) {
      return {
        ...withArea,
        reason: `We don’t deliver to ${area.name} yet. Collect from our store instead.`,
      }
    }
    return { ...withArea, ok: true, fee, freeOver: settings.free_shipping_threshold }
  }

  // Pickup: the area's own store when it has one; otherwise the store the
  // customer chose, or the only one there is.
  const { data: stores, error: storesError } = await supabase
    .from('pickup_points')
    .select(STORE_COLUMNS)
    .eq('is_active', true)
  if (storesError) throw storesError
  const active = stores || []
  const store =
    active.find((s) => s.id === area.pickup_point_id) ||
    active.find((s) => s.id === pickupPointId) ||
    (active.length === 1 ? active[0] : null)

  if (!store) {
    return {
      ...withArea,
      reason: active.length ? 'Choose the store you’ll collect from.' : 'Store pickup isn’t available right now.',
    }
  }
  // A pickup fee is a handling charge, so no free-delivery threshold applies.
  return { ...withArea, ok: true, fee: Number(store.fee) || 0, pickupPoint: store }
}

// What checkout needs to draw its choices: which ways are on, the Ibadan
// areas (with their price and store), and the active stores.
//   methods.delivery  door delivery is on AND at least one area has a price
//   methods.pickup    pickup is on AND at least one store is active
export async function loadDeliveryOptions() {
  const settings = await getSettings()
  const supabase = await createClient()

  const [areasRes, storesRes] = await Promise.all([
    supabase
      .from('delivery_areas')
      .select('id, name, aliases, delivery_fee, pickup_point_id')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('pickup_points')
      .select(STORE_COLUMNS)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ])
  if (areasRes.error) throw areasRes.error
  if (storesRes.error) throw storesRes.error

  const stores = storesRes.data || []
  const activeIds = new Set(stores.map((s) => s.id))
  const areas = (areasRes.data || []).map((a) => ({
    id: a.id,
    name: a.name,
    aliases: a.aliases || [],
    deliveryFee: money(a.delivery_fee),
    // Only a store that's open for pickup counts as the area's store.
    storeId: activeIds.has(a.pickup_point_id) ? a.pickup_point_id : null,
  }))

  return {
    methods: {
      delivery: settings.doorstep_delivery_enabled && areas.some((a) => a.deliveryFee !== null),
      pickup: settings.store_pickup_enabled && stores.length > 0,
    },
    areas,
    stores,
    freeOver: settings.free_shipping_threshold,
    supportPhone: settings.support_phone,
  }
}

// The browser's view of a quote: nothing it doesn't display.
export function publicQuote(q) {
  return {
    ok: q.ok,
    reason: q.reason,
    method: q.method,
    fee: q.fee,
    free_over: q.freeOver,
    area_name: q.area?.name || null,
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
