import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/stores/cartStore'

// Cancel an unpaid order.
//
// Goes through the cancel_my_order() RPC rather than an update: migration 009
// removed the customer's update policy on orders, because RLS gates rows and
// not columns — the old policy also let a customer rewrite total_amount. The
// function checks ownership and pending-ness itself, and touches only `status`.
export const useCancelOrder = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('cancel_my_order', {
        p_order_id: orderId,
      })
      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data
      // The function reports business-rule failures ("already paid") as a row,
      // not an exception — surface its reason rather than a generic error.
      if (!result?.ok) throw new Error(result?.reason || 'Could not cancel this order.')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
    },
  })
}

// Ask for a refund (016).
//
// Goes through request_refund(), which proves ownership and that the order is
// actually refundable. "You may only ask for a refund on an order you own that
// was paid for and isn't already refunded" is a computation, not a row
// predicate — the same reason orders have no client insert policy.
export const useRequestRefund = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, reason, details, guestToken }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('request_refund', {
        p_order_id: orderId,
        p_reason: reason,
        p_details: details || null,
        p_token: guestToken || null,
      })
      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data
      // Business-rule refusals come back as a row, not an exception.
      if (!result?.ok) throw new Error(result?.reason || 'Could not request a refund.')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-refunds'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
    },
  })
}

// The customer's own refund requests for an order, so the page can say "we're
// looking at it" instead of offering the button again.
export const useMyRefundRequest = (orderId) =>
  useQuery({
    queryKey: ['my-refunds', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const supabase = createClient()
      // RLS: "users read own refund requests".
      const { data, error } = await supabase
        .from('refund_requests')
        .select('id, status, reason, created_at, refunded_amount')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    },
  })

// Refill the cart from a past order.
//
// Deliberately does NOT restore the old prices: order_items is a snapshot of
// what was paid then, and reusing it would show the shopper a price the shop no
// longer offers. Only ids and quantities are carried over — useCartSync() on
// the cart page then fills in today's price, stock and availability, and says
// what changed.
export const useReorder = () => {
  const addItem = useCartStore((s) => s.addItem)

  return useMutation({
    mutationFn: async (order) => {
      const lines = Array.isArray(order.order_items) ? order.order_items : []
      if (lines.length === 0) throw new Error('This order has no items to reorder.')

      const ids = lines.map((l) => l.id).filter(Boolean)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('items')
        .select(
          'id, name, price, image_url, stock, is_active, allow_backorder, unit_type, vat_enabled, vat_rate, vat_inclusive'
        )
        .in('id', ids)
      if (error) throw error

      const byId = new Map((data || []).map((row) => [row.id, row]))
      const added = []
      const skipped = []

      for (const line of lines) {
        const row = byId.get(line.id)
        // Products get delisted and sell out between orders; adding a line we
        // know can't be bought would just fail at checkout instead.
        if (!row || !row.is_active) {
          skipped.push(line.name)
          continue
        }
        const soldOut =
          !row.allow_backorder && row.stock !== null && Number(row.stock) <= 0
        if (soldOut) {
          skipped.push(row.name)
          continue
        }

        addItem({
          id: row.id,
          name: row.name,
          price: row.price, // today's price, not the price they paid then
          image: row.image_url,
          quantity: Number(line.quantity) || 1,
          stock: row.stock,
          allow_backorder: row.allow_backorder,
          unit_type: row.unit_type,
          vat_enabled: row.vat_enabled,
          vat_rate: row.vat_rate,
          vat_inclusive: row.vat_inclusive,
        })
        added.push(row.name)
      }

      if (added.length === 0) {
        throw new Error('None of these items are available any more.')
      }
      return { added, skipped }
    },
  })
}
