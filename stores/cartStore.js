import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calcTotals } from '@/lib/pricing'
import { normalizeQuantity, roundQuantity, minQuantityFor } from '@/lib/units'

// How many of `item` may be in the cart. null = unlimited (no stock tracking,
// or backorders allowed).
export function maxQuantityFor(item) {
  if (!item) return null
  if (item.allow_backorder) return null
  if (item.stock === null || item.stock === undefined) return null
  return Number(item.stock)
}

// Normalise every write, then cap it at stock.
//
// kg is NOT snapped to a grid — 8.7 kg stays 8.7 kg. Feed is weighed out, so
// any 3dp weight is a real order; an earlier version snapped to 0.5 and would
// have silently sold someone 8.5 kg (and charged for 8.5) when they asked for
// 8.7. See lib/units.js.
const clamp = (item, quantity) => {
  const normalized = normalizeQuantity(quantity, item?.unit_type)
  const max = maxQuantityFor(item)
  if (max === null) return normalized
  // Stock is itself a weight (2.3 kg), so the cap is used as-is rather than
  // rounded onto a grid the product doesn't have.
  return Math.min(normalized, roundQuantity(max))
}

// Cart Store with localStorage persistence.
//
// IMPORTANT: everything in here is a SNAPSHOT taken when the item was added,
// and localStorage keeps it for as long as the browser feels like — weeks,
// across price changes, restocks and products being switched off. So it is
// display data with a shelf life, never a source of truth. Two consequences:
//   1. The server recomputes every price at order time (create-order looks up
//      the real price by id) — a stale cart can't produce a stale charge.
//   2. reconcile() below refreshes the snapshot against the catalogue so the
//      shopper isn't shown a price or a total they won't be charged.
export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      // Add item to cart
      addItem: (item) => set((state) => {
        const existingItem = state.items.find((i) => i.id === item.id)

        if (existingItem) {
          // Stock is per-product, not per-click: adding 3 to a cart that
          // already holds 2 must not sneak past a stock of 4.
          const merged = { ...existingItem, ...item }
          return {
            items: state.items.map((i) =>
              i.id === item.id
                ? {
                    ...merged,
                    quantity: clamp(merged, i.quantity + (item.quantity || 1)),
                  }
                : i
            ),
          }
        }

        return {
          items: [
            ...state.items,
            { ...item, quantity: clamp(item, item.quantity || 1) },
          ],
        }
      }),

      // Remove item from cart
      removeItem: (itemId) => set((state) => ({
        items: state.items.filter((i) => i.id !== itemId),
      })),

      // Update item quantity
      updateQuantity: (itemId, quantity) => set((state) => {
        // `< 1` would have deleted a 0.5 kg line the moment it was set — kg
        // items are legitimately fractional, so only a non-positive quantity
        // means "remove".
        if (quantity <= 0) {
          return { items: state.items.filter((i) => i.id !== itemId) }
        }

        return {
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, quantity: clamp(i, quantity) } : i
          ),
        }
      }),

      // Clear cart
      clearCart: () => set({ items: [] }),

      // Refresh the cart against fresh catalogue rows, and report what moved.
      // `fresh` is a Map of id → row (absent id = the product is gone).
      //
      // Price and stock are applied silently-but-reported: the alternative is
      // showing a total the shopper will not be charged, which is worse than a
      // visible "this changed" notice. Nothing is auto-removed — a cart that
      // quietly empties itself looks broken and hides why.
      reconcile: (fresh) => {
        const changes = []

        const items = get().items.map((item) => {
          const row = fresh.get(item.id)

          if (!row) {
            changes.push({ id: item.id, name: item.name, type: 'gone' })
            return { ...item, unavailable: true, unavailableReason: 'gone' }
          }

          const next = {
            ...item,
            name: row.name,
            image: row.image_url,
            price: Number(row.price),
            stock: row.stock === null ? null : Number(row.stock),
            allow_backorder: row.allow_backorder,
            unit_type: row.unit_type,
            vat_enabled: row.vat_enabled,
            vat_rate: row.vat_rate,
            vat_inclusive: row.vat_inclusive,
            unavailable: false,
            unavailableReason: null,
          }

          // Inactive products are still readable ("items readable by all"), so
          // this has to be checked rather than inferred from a missing row.
          if (!row.is_active) {
            changes.push({ id: item.id, name: row.name, type: 'inactive' })
            return { ...next, unavailable: true, unavailableReason: 'inactive' }
          }

          if (Number(item.price) !== Number(row.price)) {
            changes.push({
              id: item.id,
              name: row.name,
              type: 'price',
              from: Number(item.price),
              to: Number(row.price),
            })
          }

          const max = maxQuantityFor(next)
          if (max !== null && max <= 0) {
            changes.push({ id: item.id, name: row.name, type: 'out_of_stock' })
            return { ...next, unavailable: true, unavailableReason: 'out_of_stock' }
          }

          if (max !== null && item.quantity > max) {
            changes.push({
              id: item.id,
              name: row.name,
              type: 'quantity',
              from: item.quantity,
              to: max,
            })
            return { ...next, quantity: max }
          }

          return next
        })

        set({ items })
        return changes
      },

      // Get cart totals (display only — the server recomputes these
      // authoritatively at order time using the same rules + settings).
      // opts: { discount, shippingFlat, freeShippingOver }
      //   discount is a server-issued preview from validate-coupon;
      //   shipping config comes from useStoreSettings().pricingConfig.
      getCartTotals: (opts = {}) =>
        // Unavailable lines are shown but never billed — they can't be ordered.
        calcTotals(get().items.filter((i) => !i.unavailable), opts),
    }),
    {
      name: 'petdo-cart-storage', // localStorage key
    }
  )
)
