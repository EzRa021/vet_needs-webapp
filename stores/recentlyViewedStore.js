import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useQuery } from '@tanstack/react-query'

const MAX = 12

// Recently viewed lives in localStorage, not the database.
//
// It works signed-out (most browsing is), needs no migration, and costs the
// server nothing. The trade is that it's per-device — which is honest for
// "what you were just looking at" in a way a synced history wouldn't be worth
// the write amplification for.
//
// Only IDS are stored. Names and prices would go stale exactly like the cart's
// snapshot did, and the fix would be the same reconcile dance — so don't create
// the problem: hydrate from the API instead.
export const useRecentlyViewedStore = create(
  persist(
    (set) => ({
      ids: [],

      record: (id) =>
        set((state) => ({
          // Most-recent-first, de-duplicated: re-viewing a product should move
          // it to the front, not add a second entry.
          ids: [id, ...state.ids.filter((x) => x !== id)].slice(0, MAX),
        })),

      clear: () => set({ ids: [] }),
    }),
    { name: 'vetneeds-recently-viewed' }
  )
)

// Hydrate the ids into real products. `excludeId` keeps the product you're
// currently looking at out of its own "recently viewed" rail.
export const useRecentlyViewed = (excludeId = null) => {
  const ids = useRecentlyViewedStore((s) => s.ids)
  const wanted = ids.filter((id) => id !== excludeId)

  const query = useQuery({
    queryKey: ['recently-viewed', wanted],
    enabled: wanted.length > 0,
    queryFn: async () => {
      const res = await fetch(`/api/shop/items?ids=${wanted.join(',')}&limit=24`)
      if (!res.ok) throw new Error('Failed to load recently viewed')
      return (await res.json()).data || []
    },
    staleTime: 60 * 1000,
  })

  // The API returns rows in its own order; restore the order the shopper
  // actually browsed in. Products that have since been delisted simply fall out
  // (the endpoint filters is_active), which is the correct silent behaviour for
  // a rail — no "this no longer exists" tombstones on the home page.
  const items = (query.data || [])
    .slice()
    .sort((a, b) => wanted.indexOf(a.id) - wanted.indexOf(b.id))

  return { ...query, items }
}
