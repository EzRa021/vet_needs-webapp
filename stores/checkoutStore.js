import { create } from 'zustand'
import { useMutation } from '@tanstack/react-query'

const emptyShipping = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'NG',
}

// One key per checkout attempt. The server uses it to collapse a repeated
// submit (double-click, retry, refresh) onto the original order, so the key
// must stay STABLE across those retries — regenerate it only when the shopper
// genuinely means a different order (cart edited, or previous one paid for).
const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `k_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`

// Zustand Store for Checkout UI State
// NOTE: never store raw card details (number/cvv) in app state — Paystack
// hosts the card form, so we never touch card data (PCI compliance). For the
// same reason there is no billing address here: Paystack collects what it
// needs on its own page.
export const useCheckoutStore = create((set) => ({
  shippingInfo: { ...emptyShipping },
  orderNotes: '',
  currentOrder: null,
  idempotencyKey: newKey(),
  // What the cart looked like when the current key was issued.
  cartSignature: null,
  // { code, discount } — a preview only. The server re-validates and
  // recomputes the discount when the order is created.
  coupon: null,

  setCoupon: (coupon) => set({ coupon }),
  clearCoupon: () => set({ coupon: null }),

  updateShippingInfo: (info) => set((state) => ({
    shippingInfo: { ...state.shippingInfo, ...info }
  })),

  setOrderNotes: (notes) => set({ orderNotes: notes }),

  // Issues a new key only when the cart/coupon actually changed. Comparing a
  // signature rather than reacting to mounts matters: leaving checkout and
  // coming back with the same cart should still be the SAME attempt, so the
  // resubmit returns the pending order instead of creating a twin.
  syncCartSignature: (signature) => set((state) =>
    state.cartSignature === signature
      ? {}
      : { cartSignature: signature, idempotencyKey: newKey() }
  ),

  setCurrentOrder: (order) => set({ currentOrder: order }),

  resetCheckout: () => set({
    shippingInfo: { ...emptyShipping },
    orderNotes: '',
    currentOrder: null,
    coupon: null,
    // A fresh key: the finished order must never be reachable by a later
    // submit, or the shopper's next purchase would return the old one.
    idempotencyKey: newKey(),
    cartSignature: null,
  }),
}))

// TanStack Query Hook - Create Order
// The cart is intentionally NOT cleared here — it is cleared only after
// payment succeeds (success page), so an abandoned checkout keeps the cart.
export const useCreateOrder = () => {
  const { setCurrentOrder } = useCheckoutStore()

  return useMutation({
    mutationFn: async (orderData) => {
      const response = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create order')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: (order) => {
      setCurrentOrder(order)
    },
    onError: (error) => {
      console.error('Create order error:', error)
    },
  })
}
