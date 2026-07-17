import { useQuery } from '@tanstack/react-query'

// Shop filter state lives in the URL, not in a store — see
// components/product-browser.jsx. A shopper can then share or bookmark a
// filtered view, the back button steps through their filtering, and the state
// is naturally per-page instead of one global object every page fights over.
export const SHOP_DEFAULTS = {
  search: '',
  department: 'all',
  category: 'all',
  minPrice: null,
  maxPrice: null,
  sortBy: 'name',
  sortOrder: 'asc',
  page: 1,
  limit: 12,
}

// TanStack Query Hook - Fetch Departments
export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await fetch('/api/shop/departments')
      if (!response.ok) {
        throw new Error('Failed to fetch departments')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// TanStack Query Hook - Public store settings (shipping fee, free-shipping
// threshold, support contacts). Used for DISPLAY only — the server recomputes
// every total from these same settings when the order is created.
export const useStoreSettings = () => {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/shop/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Shape calcTotals() expects; falls back to its defaults until loaded.
  const pricingConfig = query.data
    ? {
        shippingFlat: query.data.shipping_flat_fee,
        freeShippingOver: query.data.free_shipping_threshold,
      }
    : {}

  return { ...query, settings: query.data, pricingConfig }
}

// TanStack Query Hook - Best sellers (015).
// Ranked by units actually sold in paid orders. Returns [] rather than throwing
// when the view isn't there yet, so the rail just doesn't render.
export const useBestSellers = (limit = 4) =>
  useQuery({
    queryKey: ['best-sellers', limit],
    queryFn: async () => {
      const response = await fetch(`/api/shop/best-sellers?limit=${limit}`)
      if (!response.ok) {
        throw new Error('Failed to fetch best sellers')
      }
      return (await response.json()).data
    },
    staleTime: 5 * 60 * 1000,
  })

// TanStack Query Hook - Delivery rate for a destination state (014).
// A quote for display only: create-order resolves the fee again from the
// order's state, so a tampered client can't ship to Sokoto at Lagos rates.
export const useShippingQuote = (state) => {
  const query = useQuery({
    queryKey: ['shipping-quote', state],
    enabled: Boolean(state),
    queryFn: async () => {
      const response = await fetch(
        `/api/shop/shipping-quote?state=${encodeURIComponent(state)}`
      )
      if (!response.ok) {
        throw new Error('Failed to quote shipping')
      }
      return (await response.json()).data
    },
    staleTime: 5 * 60 * 1000,
  })

  return query
}

// TanStack Query Hook - Live promotions for a placement.
// Returns the highest-priority (lowest sort_order) banner, or null.
export const usePromotion = (placement) => {
  const query = useQuery({
    queryKey: ['promotions', placement],
    queryFn: async () => {
      const response = await fetch(`/api/shop/promotions?placement=${placement}`)
      if (!response.ok) {
        throw new Error('Failed to fetch promotions')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })

  return { ...query, promotion: query.data?.[0] || null }
}

// TanStack Query Hook - Full nested category tree (departments → categories).
// One cached call powers the header mega-menu, the mobile drawer and the
// home page, so the storefront always reflects the real taxonomy.
export const useTaxonomy = () => {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: async () => {
      const response = await fetch('/api/shop/taxonomy')
      if (!response.ok) {
        throw new Error('Failed to fetch taxonomy')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// TanStack Query Hook - Fetch Categories
export const useCategories = (departmentId = null) => {
  return useQuery({
    queryKey: ['categories', departmentId],
    queryFn: async () => {
      const url = departmentId && departmentId !== 'all'
        ? `/api/shop/categories?department=${departmentId}`
        : '/api/shop/categories'
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// TanStack Query Hook - Fetch Items (Products)
// Filters are passed in rather than read from a store, so the caller decides
// where they come from (today: the URL).
export const useItems = (filters = SHOP_DEFAULTS) => {
  return useQuery({
    queryKey: ['items', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      Object.entries(filters).forEach(([key, value]) => {
        // Skip null, undefined, empty string, 'all' and false (an unticked
        // toggle is not a filter).
        if (value === null || value === undefined || value === '' || value === 'all') return
        if (value === false) return

        // `brands` repeats the key — the API reads it as OR within the facet.
        if (key === 'brands') {
          value.forEach((v) => params.append('brand', v))
          return
        }

        // `attrs` is a bag of arbitrary keys; flatten to attr.<key>=<value>.
        // Without this the object would stringify to "[object Object]".
        if (key === 'attrs') {
          Object.entries(value).forEach(([k, v]) => {
            if (v) params.append(`attr.${k}`, v)
          })
          return
        }

        params.append(key, value.toString())
      })

      const response = await fetch(`/api/shop/items?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch items')
      }
      return await response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: (previousData) => previousData,
  })
}

// TanStack Query Hook - Fetch Single Item
export const useItem = (id) => {
  return useQuery({
    queryKey: ['items', id],
    queryFn: async () => {
      const response = await fetch(`/api/shop/items/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch item')
      }
      const result = await response.json()
      return result.data
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
