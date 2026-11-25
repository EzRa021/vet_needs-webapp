import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Admin data for the Delivery page (029): the Ibadan areas — each with its
// door-delivery price and the store its customers collect from — and the
// stores. Read and written straight through Supabase under the "staff manage
// …" RLS policies, so the database enforces who can change them.
//
// The two shop-wide switches (door delivery, store pickup) are settings, saved
// through /api/admin/settings with useSaveSettings (stores/adminStore.js).

const KEY = ['admin', 'delivery']
export const AREA_CITY = 'Ibadan'
export const AREA_STATE = 'Oyo'

const throwIf = (res) => {
  if (res.error) throw res.error
  return res.data
}

export const useDeliveryAdmin = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const supabase = createClient()
      const [areas, stores] = await Promise.all([
        supabase
          .from('delivery_areas')
          .select('id, name, aliases, delivery_fee, pickup_point_id, is_active')
          .order('name', { ascending: true }),
        supabase
          .from('pickup_points')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ])
      return {
        areas: (throwIf(areas) || []).map((a) => ({
          ...a,
          delivery_fee: a.delivery_fee === null ? null : Number(a.delivery_fee),
        })),
        stores: throwIf(stores) || [],
      }
    },
  })

// Everything here changes what checkout offers or charges.
//
// Returned as a promise and used as onSuccess, so mutateAsync only resolves
// once the page holds the fresh rows — otherwise an edited price would flash
// its old value until the refetch lands.
const useInvalidate = () => {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: KEY }),
      qc.invalidateQueries({ queryKey: ['delivery-options'] }),
      qc.invalidateQueries({ queryKey: ['delivery-quote'] }),
    ])
}

// '' / null → null ("no door delivery"); otherwise a naira amount.
export const toFee = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN
}

const cleanAliases = (aliases) =>
  [...new Set((aliases || []).map((a) => String(a).trim()).filter(Boolean))].slice(0, 12)

// ---------- Areas ----------

// Partial update or insert. Only the fields present in the body are written.
export const useSaveArea = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const supabase = createClient()
      const payload = {}
      if ('name' in body) payload.name = body.name.trim()
      if ('aliases' in body) payload.aliases = cleanAliases(body.aliases)
      if ('delivery_fee' in body) {
        const fee = toFee(body.delivery_fee)
        if (Number.isNaN(fee)) throw new Error('The delivery price must be ₦0 or more.')
        payload.delivery_fee = fee
      }
      if ('pickup_point_id' in body) payload.pickup_point_id = body.pickup_point_id || null
      if ('is_active' in body) payload.is_active = body.is_active !== false
      if (!id) {
        payload.city = AREA_CITY
        payload.state = AREA_STATE
      }
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

// The same change to several areas at once: { ids, patch } where patch holds
// delivery_fee and/or pickup_point_id.
export const useUpdateAreas = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ ids, patch }) => {
      const supabase = createClient()
      const payload = {}
      if ('delivery_fee' in patch) {
        const fee = toFee(patch.delivery_fee)
        if (Number.isNaN(fee)) throw new Error('The delivery price must be ₦0 or more.')
        payload.delivery_fee = fee
      }
      if ('pickup_point_id' in patch) payload.pickup_point_id = patch.pickup_point_id || null
      if ('is_active' in patch) payload.is_active = patch.is_active !== false
      throwIf(await supabase.from('delivery_areas').update(payload).in('id', ids))
    },
    onSuccess: invalidate,
  })
}

// One name per line. Names already in the list are skipped, not errors.
export const useAddAreas = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ names, delivery_fee, pickup_point_id, existing }) => {
      const supabase = createClient()
      const fee = toFee(delivery_fee)
      if (Number.isNaN(fee)) throw new Error('The delivery price must be ₦0 or more.')
      const taken = new Set((existing || []).map((n) => n.toLowerCase()))
      const rows = []
      for (const raw of names) {
        const name = raw.trim().slice(0, 80)
        if (!name || taken.has(name.toLowerCase())) continue
        taken.add(name.toLowerCase())
        rows.push({
          city: AREA_CITY,
          state: AREA_STATE,
          name,
          delivery_fee: fee,
          pickup_point_id: pickup_point_id || null,
        })
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

// ---------- Stores ----------

export const useSaveStore = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const supabase = createClient()
      const text = (v, n = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
      const payload = {
        name: body.name.trim(),
        address: (body.address || '').trim(),
        city: AREA_CITY,
        state: AREA_STATE,
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
      if (res.error?.code === '23514') throw new Error('Add the store address before opening it for pickup.')
      return throwIf(res)
    },
    onSuccess: invalidate,
  })
}

export const useDeleteStore = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      // Its areas fall back to "no store" (on delete set null).
      throwIf(await supabase.from('pickup_points').delete().eq('id', id))
    },
    onSuccess: invalidate,
  })
}
