import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/stores/cartStore'

// Revalidates a localStorage cart against the live catalogue.
//
// Why this exists: the cart survives in the browser indefinitely, holding the
// price, name and stock captured when the item was added. A shopper who returns
// a week later sees last week's prices and a checkout total the server will not
// honour — create-order looks every price up again, so the amount charged would
// differ from the amount shown. That's not a security hole (the server is
// authoritative), it's a trust one.
export function useCartSync() {
  const items = useCartStore((s) => s.items)
  const reconcile = useCartStore((s) => s.reconcile)
  const [changes, setChanges] = useState([])

  const ids = items.map((i) => i.id).sort()
  const key = ids.join(',')

  const query = useQuery({
    queryKey: ['cart-sync', key],
    enabled: ids.length > 0,
    // Always refetch when the cart is opened: staleness is the whole problem.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const supabase = createClient()
      // Inactive products are readable too ("items readable by all"), which is
      // what lets us tell "switched off" apart from "deleted" — a deleted id
      // simply won't come back.
      const { data, error } = await supabase
        .from('items')
        .select(
          'id, name, price, stock, is_active, allow_backorder, unit_type, image_url, vat_enabled, vat_rate, vat_inclusive'
        )
        .in('id', ids)
      if (error) throw error
      return data || []
    },
  })

  // Reconcile once per fetch. Writing to the store during render would loop:
  // reconcile() changes `items`, which re-renders this hook.
  const lastApplied = useRef(null)
  useEffect(() => {
    if (!query.data) return
    const stamp = `${key}:${query.dataUpdatedAt}`
    if (lastApplied.current === stamp) return
    lastApplied.current = stamp

    const fresh = new Map(query.data.map((row) => [row.id, row]))
    setChanges(reconcile(fresh))
  }, [query.data, query.dataUpdatedAt, key, reconcile])

  return {
    isChecking: query.isLoading,
    changes,
    dismiss: () => setChanges([]),
    // Checkout must be blocked while any line can't actually be bought:
    // create-order would reject the whole order anyway, and doing it here says
    // which product is the problem instead of failing at the last step.
    hasBlockers: items.some((i) => i.unavailable),
  }
}
