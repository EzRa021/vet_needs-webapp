import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Current user's profile + role (drives the admin UI guard and nav).
export const useProfile = () =>
  useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return { ...data, email: user.email }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

export const useIsStaff = () => {
  const { data: profile, isLoading } = useProfile()
  return {
    isStaff: profile?.role === 'admin' || profile?.role === 'staff',
    isAdmin: profile?.role === 'admin',
    isLoading,
  }
}

// ---------- Dashboard stats ----------
export const useAdminStats = () =>
  useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to load stats')
      return (await res.json()).data
    },
    staleTime: 60 * 1000,
  })

// ---------- Category tree ----------
export const useAdminTaxonomy = () =>
  useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: async () => {
      const res = await fetch('/api/admin/categories')
      if (!res.ok) throw new Error('Failed to load categories')
      return (await res.json()).data
    },
    staleTime: 30 * 1000,
  })

const invalidateTaxonomy = (qc) => {
  qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
  qc.invalidateQueries({ queryKey: ['categories'] })
  qc.invalidateQueries({ queryKey: ['departments'] })
}

export const useSaveCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = await fetch(
        id ? `/api/admin/categories/${id}` : '/api/admin/categories',
        {
          method: id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save category')
      return json.data
    },
    onSuccess: () => invalidateTaxonomy(qc),
  })
}

export const useDeleteCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete category')
      return json
    },
    onSuccess: () => invalidateTaxonomy(qc),
  })
}

// ---------- Products ----------
export const useAdminProducts = (filters) =>
  useQuery({
    queryKey: ['admin', 'products', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '' && v !== 'all') {
          params.append(k, String(v))
        }
      })
      const res = await fetch(`/api/admin/products?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load products')
      return res.json()
    },
    placeholderData: (prev) => prev,
    staleTime: 15 * 1000,
  })

export const useAdminProduct = (id) =>
  useQuery({
    queryKey: ['admin', 'product', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${id}`)
      if (!res.ok) throw new Error('Failed to load product')
      return (await res.json()).data
    },
  })

const invalidateProducts = (qc) => {
  qc.invalidateQueries({ queryKey: ['admin', 'products'] })
  qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
  qc.invalidateQueries({ queryKey: ['items'] })
}

// Stock movement with a reason (021). Not a plain items.update: the reason has
// to be set in the same transaction as the write for the history trigger to see
// it, which only an RPC can do.
export const useAdjustStock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, delta, reason, note }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('adjust_stock', {
        p_item_id: itemId,
        p_delta: delta,
        p_reason: reason,
        p_note: note || null,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (_d, vars) => {
      invalidateProducts(qc)
      qc.invalidateQueries({ queryKey: ['admin', 'product', vars.itemId] })
      qc.invalidateQueries({ queryKey: ['admin', 'item-history', vars.itemId] })
      // Stock drives the storefront's in-stock facet and the cart's clamp.
      qc.invalidateQueries({ queryKey: ['facets'] })
    },
  })
}

export const useBulkProducts = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Bulk update failed')
      return json.data
    },
    onSuccess: () => {
      invalidateProducts(qc)
      // A bulk reprice or deactivate changes what the storefront shows.
      qc.invalidateQueries({ queryKey: ['facets'] })
      qc.invalidateQueries({ queryKey: ['best-sellers'] })
    },
  })
}

export const useSaveProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = await fetch(
        id ? `/api/admin/products/${id}` : '/api/admin/products',
        {
          method: id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save product')
      return json.data
    },
    onSuccess: (_d, vars) => {
      invalidateProducts(qc)
      if (vars.id) qc.invalidateQueries({ queryKey: ['admin', 'product', vars.id] })
    },
  })
}

export const useDeleteProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete product')
      return json
    },
    onSuccess: () => invalidateProducts(qc),
  })
}

// ---------- Orders ----------
export const useAdminOrders = (filters) =>
  useQuery({
    queryKey: ['admin', 'orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '' && v !== 'all') {
          params.append(k, String(v))
        }
      })
      const res = await fetch(`/api/admin/orders?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load orders')
      return res.json()
    },
    placeholderData: (prev) => prev,
    staleTime: 15 * 1000,
  })

export const useAdminOrder = (id) =>
  useQuery({
    queryKey: ['admin', 'order', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders/${id}`)
      if (!res.ok) throw new Error('Failed to load order')
      return (await res.json()).data
    },
  })

// ---------- Promotions (staff) ----------
export const useAdminPromotions = () =>
  useQuery({
    queryKey: ['admin', 'promotions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promotions')
      if (!res.ok) throw new Error('Failed to load promotions')
      return (await res.json()).data
    },
    staleTime: 30 * 1000,
  })

const invalidatePromotions = (qc) => {
  qc.invalidateQueries({ queryKey: ['admin', 'promotions'] })
  qc.invalidateQueries({ queryKey: ['promotions'] })
}

export const useSavePromotion = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = await fetch(id ? `/api/admin/promotions/${id}` : '/api/admin/promotions', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save promotion')
      return json.data
    },
    onSuccess: () => invalidatePromotions(qc),
  })
}

export const useDeletePromotion = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete promotion')
      return json
    },
    onSuccess: () => invalidatePromotions(qc),
  })
}

// ---------- Settings (admin-only) ----------
export const useAdminSettings = () =>
  useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) throw new Error('Failed to load settings')
      return (await res.json()).data
    },
    staleTime: 30 * 1000,
  })

export const useSaveSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save settings')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

// ---------- Coupons (admin-only) ----------
export const useAdminCoupons = (search) =>
  useQuery({
    queryKey: ['admin', 'coupons', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await fetch(`/api/admin/coupons?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load coupons')
      return (await res.json()).data
    },
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  })

export const useAdminCoupon = (id) =>
  useQuery({
    queryKey: ['admin', 'coupon', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/coupons/${id}`)
      if (!res.ok) throw new Error('Failed to load coupon')
      return (await res.json()).data
    },
  })

const invalidateCoupons = (qc) => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] })

export const useSaveCoupon = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = await fetch(id ? `/api/admin/coupons/${id}` : '/api/admin/coupons', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save coupon')
      return json.data
    },
    onSuccess: (_d, vars) => {
      invalidateCoupons(qc)
      if (vars.id) qc.invalidateQueries({ queryKey: ['admin', 'coupon', vars.id] })
    },
  })
}

export const useDeleteCoupon = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete coupon')
      return json
    },
    onSuccess: () => invalidateCoupons(qc),
  })
}

// ---------- Customers (admin-only) ----------
export const useAdminCustomers = (filters) =>
  useQuery({
    queryKey: ['admin', 'customers', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '' && v !== 'all') {
          params.append(k, String(v))
        }
      })
      const res = await fetch(`/api/admin/customers?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load customers')
      return res.json()
    },
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  })

export const useAdminCustomer = (id) =>
  useQuery({
    queryKey: ['admin', 'customer', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/customers/${id}`)
      if (!res.ok) throw new Error('Failed to load customer')
      return (await res.json()).data
    },
  })

export const useUpdateCustomerRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }) => {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update role')
      return json.data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] })
      qc.invalidateQueries({ queryKey: ['admin', 'customer', vars.id] })
    },
  })
}

// Contact messages (005). The table, its RLS and the status workflow have
// existed since 005 — only the reading half was never built, so every message a
// customer sent landed somewhere nobody could look. Read/written through the
// client: "staff read messages" / "staff manage messages" are genuine
// row-level rules.
export const useContactMessages = (status = 'new') =>
  useQuery({
    queryKey: ['admin', 'messages', status],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('contact_messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100)
      if (status !== 'all') q = q.eq('status', status)

      const { data, error, count } = await q
      if (error) throw error
      return { data: data || [], total: count || 0 }
    },
    placeholderData: (prev) => prev,
    staleTime: 15 * 1000,
  })

// Unread count for the nav badge — the whole point is that staff notice.
export const useUnreadMessageCount = () =>
  useQuery({
    queryKey: ['admin', 'messages', 'unread-count'],
    queryFn: async () => {
      const supabase = createClient()
      const { count, error } = await supabase
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
      if (error) throw error
      return count || 0
    },
    staleTime: 30 * 1000,
  })

export const useUpdateMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contact_messages')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'messages'] }),
  })
}

// Newsletter subscribers (005). Same story: `is_active` / `unsubscribed_at`
// have been there all along with nothing to read or write them.
export const useSubscribers = (activeOnly = true) =>
  useQuery({
    queryKey: ['admin', 'subscribers', activeOnly],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('subscribers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1000)
      if (activeOnly) q = q.eq('is_active', true)

      const { data, error, count } = await q
      if (error) throw error
      return { data: data || [], total: count || 0 }
    },
    placeholderData: (prev) => prev,
  })

// Back-in-stock queue (022). Read through the client with the staff RLS policy.
export const useStockNotifications = (status = 'ready') =>
  useQuery({
    queryKey: ['admin', 'stock-notifications', status],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('stock_notifications')
        .select(
          'id, email, phone, notify_by, status, created_at, ready_at, notified_at, item:items (id, name, stock)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .limit(200)
      if (status !== 'all') q = q.eq('status', status)

      const { data, error, count } = await q
      if (error) throw error
      return { data: data || [], total: count || 0 }
    },
    staleTime: 15 * 1000,
  })

// Drains the ready queue via the send endpoint (which does the actual mailing
// server-side with the service role).
export const useSendStockNotifications = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/stock-notifications/send', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      return json.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stock-notifications'] }),
  })
}

// Inventory valuation (023 + inventory route). cost_price is service-role only,
// so this always comes from the API, never a direct client read.
export const useInventory = () =>
  useQuery({
    queryKey: ['admin', 'inventory'],
    queryFn: async () => {
      const res = await fetch('/api/admin/inventory')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load inventory')
      return json.data
    },
    staleTime: 30 * 1000,
  })

// Reports (017).
export const useReports = (range) =>
  useQuery({
    queryKey: ['admin', 'reports', range?.from, range?.to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (range?.from) params.set('from', range.from)
      if (range?.to) params.set('to', range.to)
      const res = await fetch(`/api/admin/reports?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load reports')
      return json.data
    },
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
  })

// Refunds (016).
export const useAdminRefunds = (status = 'requested') =>
  useQuery({
    queryKey: ['admin', 'refunds', status],
    queryFn: async () => {
      const res = await fetch(`/api/admin/refunds?status=${status}`)
      if (!res.ok) throw new Error('Failed to load refunds')
      return res.json()
    },
    placeholderData: (prev) => prev,
    staleTime: 15 * 1000,
  })

export const useReviewRefund = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to process refund')
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refunds'] })
      // A processed refund changes the order's status and may restock items.
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}

// Shipping zones (014). Read/written through the client with the
// "staff manage shipping zones" RLS policy — a genuine row-level rule, unlike
// the order rules that had to move server-side.
export const useShippingZones = () =>
  useQuery({
    queryKey: ['admin', 'shipping-zones'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

const invalidateZones = (qc) => {
  qc.invalidateQueries({ queryKey: ['admin', 'shipping-zones'] })
  // The storefront quotes from these.
  qc.invalidateQueries({ queryKey: ['shipping-quote'] })
}

export const useSaveShippingZone = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const supabase = createClient()
      const payload = {
        name: body.name?.trim(),
        states: body.states || [],
        fee: Number(body.fee) || 0,
        free_over:
          body.free_over === '' || body.free_over === null || body.free_over === undefined
            ? null
            : Number(body.free_over),
        delivery_estimate: body.delivery_estimate?.trim() || null,
        is_active: body.is_active !== false,
        sort_order: Number(body.sort_order) || 0,
      }
      const q = id
        ? supabase.from('shipping_zones').update(payload).eq('id', id)
        : supabase.from('shipping_zones').insert(payload)
      const { data, error } = await q.select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateZones(qc),
  })
}

export const useDeleteShippingZone = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      const { error } = await supabase.from('shipping_zones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateZones(qc),
  })
}

export const useAdminReviews = (filters) =>
  useQuery({
    queryKey: ['admin', 'reviews', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '' && v !== 'all') {
          params.append(k, String(v))
        }
      })
      const res = await fetch(`/api/admin/reviews?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load reviews')
      return res.json()
    },
    placeholderData: (prev) => prev,
    staleTime: 15 * 1000,
  })

// Hiding a review changes items.rating_avg/rating_count (the trigger only
// counts approved ones), so the storefront's cached product data goes stale.
const invalidateReviews = (qc) => {
  qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
  qc.invalidateQueries({ queryKey: ['reviews'] })
  qc.invalidateQueries({ queryKey: ['items'] })
}

export const useModerateReview = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_approved }) => {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update review')
      return json.data
    },
    onSuccess: () => invalidateReviews(qc),
  })
}

export const useDeleteAdminReview = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to delete review')
      }
      return true
    },
    onSuccess: () => invalidateReviews(qc),
  })
}

export const useUpdateOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update order')
      return json.data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      qc.invalidateQueries({ queryKey: ['admin', 'order', vars.id] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      qc.invalidateQueries({ queryKey: ['my-orders'] })
    },
  })
}
