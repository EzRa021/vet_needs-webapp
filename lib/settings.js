import { createClient } from '@/lib/supabase/server'

// Store settings live in the `settings` table (jsonb key → value) so an admin
// can change them without a deploy. This module is the ONLY place the server
// reads them, and it always falls back to safe defaults — a missing row or a
// database blip must never break checkout or produce a free order.

export const SETTING_DEFAULTS = {
  store_name: 'PetDo',
  currency: 'NGN',
  shipping_flat_fee: 1500,
  vat_rate: 0.075, // decimal, i.e. 7.5% — only a default for new products
  support_email: '',
  support_phone: '',
  free_shipping_threshold: null, // null = never free
}

// Settings change rarely and checkout reads them on every order, so cache in
// module memory. Short TTL keeps an admin edit visible within a minute without
// hammering the database.
const TTL_MS = 60 * 1000
let cache = null
let cachedAt = 0

const num = (v, fallback) => {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('settings').select('key, value')
    if (error) throw error

    const raw = Object.fromEntries((data || []).map((r) => [r.key, r.value]))

    cache = {
      ...SETTING_DEFAULTS,
      store_name: raw.store_name || SETTING_DEFAULTS.store_name,
      currency: raw.currency || SETTING_DEFAULTS.currency,
      shipping_flat_fee: num(raw.shipping_flat_fee, SETTING_DEFAULTS.shipping_flat_fee),
      vat_rate: num(raw.vat_rate, SETTING_DEFAULTS.vat_rate),
      support_email: raw.support_email ?? SETTING_DEFAULTS.support_email,
      support_phone: raw.support_phone ?? SETTING_DEFAULTS.support_phone,
      // null is meaningful here (free shipping disabled), so don't coerce to 0
      free_shipping_threshold:
        raw.free_shipping_threshold === null || raw.free_shipping_threshold === undefined
          ? null
          : num(raw.free_shipping_threshold, null),
    }
    cachedAt = Date.now()
    return cache
  } catch (e) {
    console.error('Settings load failed, using defaults:', e.message)
    return { ...SETTING_DEFAULTS }
  }
}

// The subset calcTotals() needs. Keeps pricing decoupled from the settings shape.
export async function getPricingConfig() {
  const s = await getSettings()
  return {
    shippingFlat: s.shipping_flat_fee,
    freeShippingOver: s.free_shipping_threshold,
  }
}

// Called after an admin saves so the next request sees the change immediately.
export function invalidateSettingsCache() {
  cache = null
  cachedAt = 0
}
