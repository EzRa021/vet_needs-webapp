import { createClient } from '@/lib/supabase/server'
import { getPricingConfig } from '@/lib/settings'

// Resolves the delivery rule for a destination state (014).
//
// Returns the shape calcTotals() already expects — { shippingFlat,
// freeShippingOver } — so pricing doesn't need to learn about zones.
//
// Falls back to the flat settings fee if the zone table is empty, unreachable,
// or the state doesn't resolve. Shipping is on the order path: it must always
// produce a number, and a shop that can't quote delivery can't sell.
export async function resolveShipping(state) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('resolve_shipping', {
      p_state: state || null,
    })
    if (error) throw error

    const zone = Array.isArray(data) ? data[0] : data
    if (zone) {
      return {
        shippingFlat: Number(zone.fee),
        // null is meaningful (never free in this zone), so don't coerce to 0.
        freeShippingOver:
          zone.free_over === null || zone.free_over === undefined
            ? null
            : Number(zone.free_over),
        zone: {
          id: zone.zone_id,
          name: zone.zone_name,
          delivery_estimate: zone.delivery_estimate,
        },
      }
    }
  } catch (e) {
    console.error('Shipping zone lookup failed, using flat settings fee:', e.message)
  }

  // No zone matched (or 014 hasn't run): behave exactly as before.
  const config = await getPricingConfig()
  return { ...config, zone: null }
}
