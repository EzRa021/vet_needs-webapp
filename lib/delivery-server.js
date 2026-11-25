import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { NIGERIAN_STATES } from '@/lib/nigeria'

// Server-side delivery (029, 031). The checkout quote and create-order both
// call quoteDelivery(), so the number a customer sees is the number they're
// charged. The browser's copy of a quote is never trusted.
//
// The model, as the shop runs it:
//   * The customer chooses their STATE first. Each state is priced one way
//     (delivery_states.pricing_mode):
//       fixed  pick an area; pay that area's price at checkout (Oyo/Ibadan)
//       quote  place the order now; the shop calls or WhatsApps to agree the
//              delivery fee before dispatch (every other state, for now)
//     A fixed state with no priced area yet is treated as quote, so switching
//     a state to fixed before its prices are in never blocks anyone.
//   * In a fixed state an area with no price has no door delivery — its
//     customers collect instead (029).
//   * Pickup is from the store the area is assigned to. Without one (an
//     unassigned area, or a state where the area is optional), the customer
//     chooses, or the only store is used.
//   * Door delivery and pickup can each be switched off shop-wide (settings).

const STORE_COLUMNS = 'id, name, address, city, state, phone, hours, map_url, instructions, fee'
const AREA_COLUMNS = 'id, name, aliases, city, state, delivery_fee, pickup_point_id'

const money = (v) => (v === null || v === undefined ? null : Number(v))
const clip = (v, n) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '')

// 031 not run yet (no delivery_states table): behave as it would seed —
// Oyo fixed, everywhere else quote — rather than break checkout.
const missingTable = (error) => error?.code === '42P01' || /delivery_states/.test(error?.message || '')
const defaultMode = (state) => (state === 'Oyo' ? 'fixed' : 'quote')

async function stateModes(supabase) {
  const { data, error } = await supabase.from('delivery_states').select('state, pricing_mode')
  if (error) {
    if (missingTable(error)) return new Map(NIGERIAN_STATES.map((s) => [s, defaultMode(s)]))
    throw error
  }
  const modes = new Map((data || []).map((r) => [r.state, r.pricing_mode]))
  for (const s of NIGERIAN_STATES) if (!modes.has(s)) modes.set(s, 'quote')
  return modes
}

// The mode checkout actually uses: fixed only once there's a price to charge.
const effectiveMode = (mode, areas) =>
  mode === 'fixed' && areas.some((a) => a.delivery_fee !== null && a.delivery_fee !== undefined)
    ? 'fixed'
    : 'quote'

// Returns:
//   ok        true when the order can be placed
//   reason    what to tell the customer when ok is false
//   method, pricing ('fixed' | 'quote' | null for pickup), fee, freeOver,
//   state, town, area, pickupPoint
// A quote delivery is ok with fee 0: the fee is agreed after the order.
export async function quoteDelivery({
  method = 'delivery',
  state = null,
  areaId = null,
  city = null,
  pickupPointId = null,
}) {
  const settings = await getSettings()
  const base = {
    ok: false,
    reason: null,
    method: method === 'pickup' ? 'pickup' : 'delivery',
    pricing: null,
    fee: null,
    freeOver: null,
    state: null,
    town: null,
    area: null,
    pickupPoint: null,
  }

  if (base.method === 'delivery' && !settings.doorstep_delivery_enabled) {
    return { ...base, reason: 'Delivery to your door isn’t available right now. Collect from our store instead.' }
  }
  if (base.method === 'pickup' && !settings.store_pickup_enabled) {
    return { ...base, reason: 'Store pickup isn’t available right now. Choose delivery to your door instead.' }
  }

  if (!NIGERIAN_STATES.includes(state)) return { ...base, reason: 'Choose your state.' }

  const supabase = await createClient()
  const [modes, areasRes] = await Promise.all([
    stateModes(supabase),
    supabase.from('delivery_areas').select(AREA_COLUMNS).eq('state', state).eq('is_active', true),
  ])
  if (areasRes.error) throw areasRes.error
  const areas = areasRes.data || []
  const mode = effectiveMode(modes.get(state), areas)

  const area = areaId ? areas.find((a) => a.id === areaId) || null : null
  if (areaId && !area) {
    return { ...base, state, reason: 'That area isn’t on our list for your state any more. Choose your area again.' }
  }

  const withPlace = {
    ...base,
    state,
    area: area ? { id: area.id, name: area.name, city: area.city, state: area.state } : null,
  }

  if (base.method === 'delivery') {
    if (mode === 'fixed') {
      if (!area) return { ...withPlace, pricing: 'fixed', reason: 'Choose your area.' }
      const fee = money(area.delivery_fee)
      if (fee === null) {
        return {
          ...withPlace,
          pricing: 'fixed',
          reason: `We don’t deliver to ${area.name} yet. Collect from our store instead.`,
        }
      }
      return {
        ...withPlace,
        ok: true,
        pricing: 'fixed',
        fee,
        freeOver: settings.free_shipping_threshold,
        town: area.city,
      }
    }

    // Quote: no fee now. The area is required where the state has a list,
    // otherwise the customer types their town.
    if (areas.length && !area) return { ...withPlace, pricing: 'quote', reason: 'Choose your area.' }
    const town = area?.city || clip(city, 80)
    if (!town) return { ...withPlace, pricing: 'quote', reason: 'Enter your city or town.' }
    return { ...withPlace, ok: true, pricing: 'quote', fee: 0, town }
  }

  // Pickup. In a fixed state the area decides the store, so it's required.
  if (mode === 'fixed' && areas.length && !area) return { ...withPlace, reason: 'Choose your area.' }

  const { data: stores, error: storesError } = await supabase
    .from('pickup_points')
    .select(STORE_COLUMNS)
    .eq('is_active', true)
  if (storesError) throw storesError
  const active = stores || []
  const store =
    active.find((s) => s.id === area?.pickup_point_id) ||
    active.find((s) => s.id === pickupPointId) ||
    (active.length === 1 ? active[0] : null)

  if (!store) {
    return {
      ...withPlace,
      reason: active.length ? 'Choose the store you’ll collect from.' : 'Store pickup isn’t available right now.',
    }
  }
  // A pickup fee is a handling charge, so no free-delivery threshold applies.
  return { ...withPlace, ok: true, fee: Number(store.fee) || 0, pickupPoint: store }
}

// What checkout needs to draw its choices:
//   methods  which ways are on (door delivery: the switch; pickup: the
//            switch AND an open store)
//   states   every state with the mode checkout will use and its area count
//   areas    active areas in every state, with price and pickup store
//   stores   active stores
export async function loadDeliveryOptions() {
  const settings = await getSettings()
  const supabase = await createClient()

  const [modes, areasRes, storesRes] = await Promise.all([
    stateModes(supabase),
    supabase
      .from('delivery_areas')
      .select(AREA_COLUMNS)
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
  const openIds = new Set(stores.map((s) => s.id))
  const rows = areasRes.data || []

  const states = NIGERIAN_STATES.map((state) => {
    const inState = rows.filter((a) => a.state === state)
    return { state, mode: effectiveMode(modes.get(state), inState), areaCount: inState.length }
  })

  return {
    methods: {
      delivery: settings.doorstep_delivery_enabled,
      pickup: settings.store_pickup_enabled && stores.length > 0,
    },
    states,
    areas: rows.map((a) => ({
      id: a.id,
      name: a.name,
      aliases: a.aliases || [],
      city: a.city,
      state: a.state,
      deliveryFee: money(a.delivery_fee),
      // Only a store that's open for pickup counts as the area's store.
      storeId: openIds.has(a.pickup_point_id) ? a.pickup_point_id : null,
    })),
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
    pricing: q.pricing,
    fee: q.fee,
    free_over: q.freeOver,
    state: q.state,
    town: q.town,
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
