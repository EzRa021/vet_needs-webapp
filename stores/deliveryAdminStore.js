import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { withBandRanges } from '@/lib/delivery'

// Admin data for the Delivery page (028): zones, their weight prices, weight
// bands, areas and pickup points. Read and written straight through Supabase
// under the "staff manage …" RLS policies — real row rules, like 014's zones.

const KEY = ['admin', 'delivery']

const throwIf = (res) => {
  if (res.error) throw res.error
  return res.data
}

export const useDeliveryAdmin = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const supabase = createClient()
      const [zones, rates, bands, areas, pickupPoints, unweighed] = await Promise.all([
        supabase
          .from('shipping_zones')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase.from('shipping_zone_rates').select('zone_id, band_id, fee'),
        supabase.from('delivery_weight_bands').select('id, up_to_kg'),
        supabase
          .from('delivery_areas')
          .select('*')
          .order('city', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('pickup_points')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        // Piece items with no weight are priced as weighing nothing.
        supabase
          .from('items')
          .select('id, name', { count: 'exact' })
          .eq('unit_type', 'piece')
          .eq('is_active', true)
          .is('weight_grams', null)
          .order('name', { ascending: true })
          .limit(25),
      ])

      const rateMap = {}
      for (const r of throwIf(rates) || []) {
        ;(rateMap[r.zone_id] ||= {})[r.band_id] = Number(r.fee)
      }

      return {
        zones: throwIf(zones) || [],
        rates: rateMap,
        bands: withBandRanges(throwIf(bands) || []),
        areas: throwIf(areas) || [],
        pickupPoints: throwIf(pickupPoints) || [],
        unweighed: { items: throwIf(unweighed) || [], count: unweighed.count ?? 0 },
      }
    },
  })

// Everything that changes a price also changes what checkout quotes.
//
// Returned as a promise and used as onSuccess, so mutateAsync only resolves
// once the page holds the fresh rows. Otherwise the price table clears its
// draft first and each edited cell flashes its OLD price until the refetch
// lands — and an edit typed in that moment compares against stale data.
const useInvalidate = () => {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: KEY }),
      qc.invalidateQueries({ queryKey: ['delivery-options'] }),
      qc.invalidateQueries({ queryKey: ['delivery-quote'] }),
    ])
}

const money = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

// ---------- Zones ----------

export const useSaveZone = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const supabase = createClient()
      const city = body.city?.trim() || null
      const payload = {
        name: body.name?.trim(),
        city,
        // An area zone never holds states (028 check constraint).
        states: city ? [] : body.states || [],
        fee: money(body.fee),
        free_over: money(body.free_over),
        delivery_estimate: body.delivery_estimate?.trim() || null,
        is_active: body.is_active !== false,
        is_city_fallback: Boolean(city && body.is_city_fallback),
        sort_order: Number(body.sort_order) || 0,
      }
      // Only one fallback per city: clear the old one first, or the unique
      // index refuses the save.
      if (payload.is_city_fallback) {
        const clear = supabase
          .from('shipping_zones')
          .update({ is_city_fallback: false })
          .eq('is_city_fallback', true)
          .ilike('city', city)
        throwIf(await (id ? clear.neq('id', id) : clear))
      }
      const q = id
        ? supabase.from('shipping_zones').update(payload).eq('id', id)
        : supabase.from('shipping_zones').insert(payload)
      return throwIf(await q.select().single())
    },
    onSuccess: invalidate,
  })
}

export const useDeleteZone = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      // Areas fall back to "not assigned" (on delete set null); rates cascade.
      throwIf(await supabase.from('shipping_zones').delete().eq('id', id))
    },
    onSuccess: invalidate,
  })
}

// fees: { [zoneId]: { [bandId]: number | '' | null } } — blank removes the
// price, which is how "no online price for this weight" is written.
export const useSaveRates = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (fees) => {
      const supabase = createClient()
      const upserts = []
      const removals = []
      for (const [zoneId, byBand] of Object.entries(fees)) {
        for (const [bandId, raw] of Object.entries(byBand)) {
          const fee = money(raw)
          if (fee === null) removals.push({ zoneId, bandId })
          else upserts.push({ zone_id: zoneId, band_id: bandId, fee })
        }
      }
      if (upserts.length) {
        throwIf(await supabase.from('shipping_zone_rates').upsert(upserts, { onConflict: 'zone_id,band_id' }))
      }
      for (const { zoneId, bandId } of removals) {
        throwIf(
          await supabase.from('shipping_zone_rates').delete().eq('zone_id', zoneId).eq('band_id', bandId)
        )
      }
    },
    onSuccess: invalidate,
  })
}

// ---------- Weight bands ----------

export const useSaveBand = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, up_to_kg }) => {
      const supabase = createClient()
      const payload = { up_to_kg: up_to_kg === '' || up_to_kg === null ? null : Number(up_to_kg) }
      const q = id
        ? supabase.from('delivery_weight_bands').update(payload).eq('id', id)
        : supabase.from('delivery_weight_bands').insert(payload)
      const res = await q.select().single()
      if (res.error?.code === '23505') throw new Error('There is already a band with that limit.')
      return throwIf(res)
    },
    onSuccess: invalidate,
  })
}

export const useDeleteBand = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      throwIf(await supabase.from('delivery_weight_bands').delete().eq('id', id))
    },
    onSuccess: invalidate,
  })
}

// ---------- Areas ----------

const cleanAliases = (aliases) =>
  [...new Set((aliases || []).map((a) => String(a).trim()).filter(Boolean))].slice(0, 12)

export const useSaveArea = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const supabase = createClient()
      const payload = {}
      if ('name' in body) payload.name = body.name.trim()
      if ('city' in body) payload.city = body.city.trim()
      if ('state' in body) payload.state = body.state.trim()
      if ('aliases' in body) payload.aliases = cleanAliases(body.aliases)
      if ('zone_id' in body) payload.zone_id = body.zone_id || null
      if ('is_active' in body) payload.is_active = body.is_active !== false
      const q = id
        ? supabase.from('delivery_areas').update(payload).eq('id', id)
        : supabase.from('delivery_areas').insert(payload)
      const res = await q.select().single()
      if (res.error?.code === '23505') throw new Error(`${payload.name || 'That area'} is already in the list.`)
      return throwIf(res)
    },
    onSuccess: invalidate,
  })
}

// Move several areas to one zone (or to "not assigned") at once.
export const useAssignAreas = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ ids, zone_id }) => {
      const supabase = createClient()
      throwIf(await supabase.from('delivery_areas').update({ zone_id: zone_id || null }).in('id', ids))
    },
    onSuccess: invalidate,
  })
}

// One name per line. Names already in the city are skipped, not errors.
export const useAddAreas = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ city, state, zone_id, names, existing }) => {
      const supabase = createClient()
      const taken = new Set((existing || []).map((n) => n.toLowerCase()))
      const rows = []
      for (const raw of names) {
        const name = raw.trim()
        if (!name || taken.has(name.toLowerCase())) continue
        taken.add(name.toLowerCase())
        rows.push({ city: city.trim(), state: state.trim(), name, zone_id: zone_id || null })
      }
      if (rows.length) throwIf(await supabase.from('delivery_areas').insert(rows))
      return { added: rows.length, skipped: names.filter((n) => n.trim()).length - rows.length }
    },
    onSuccess: invalidate,
  })
}

export const useDeleteArea = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      throwIf(await supabase.from('delivery_areas').delete().eq('id', id))
    },
    onSuccess: invalidate,
  })
}

// ---------- Pickup points ----------

export const useSavePickupPoint = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const supabase = createClient()
      const text = (v, n = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
      const payload = {
        name: body.name.trim(),
        address: (body.address || '').trim(),
        city: body.city.trim(),
        state: body.state.trim(),
        phone: text(body.phone, 40),
        hours: text(body.hours, 120),
        map_url: text(body.map_url, 500),
        instructions: text(body.instructions, 300),
        fee: Number(body.fee) || 0,
        is_active: Boolean(body.is_active),
      }
      const q = id
        ? supabase.from('pickup_points').update(payload).eq('id', id)
        : supabase.from('pickup_points').insert(payload)
      const res = await q.select().single()
      if (res.error?.code === '23514') throw new Error('Add the store address before switching pickup on.')
      return throwIf(res)
    },
    onSuccess: invalidate,
  })
}

export const useDeletePickupPoint = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      throwIf(await supabase.from('pickup_points').delete().eq('id', id))
    },
    onSuccess: invalidate,
  })
}

// ---------- Price tester ----------

// Runs the same resolver checkout uses, for a weight staff type in.
export const useTestPrice = (input, { enabled }) =>
  useQuery({
    queryKey: ['admin', 'delivery-test', input],
    enabled,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('resolve_delivery', {
        p_state: input.state || null,
        p_city: input.city || null,
        p_area_id: input.areaId || null,
        p_weight_kg: Number(input.weightKg) || 0,
      })
      if (error) throw error
      return (Array.isArray(data) ? data[0] : data) || null
    },
  })
