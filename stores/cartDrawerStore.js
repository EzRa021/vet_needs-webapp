import { create } from 'zustand'

// The cart side drawer: open/closed, and which product was just added (so it
// can say so). Not persisted — a drawer that reopens itself on the next visit
// would be a surprise, not a convenience.
//
// `mounted` is set by <CartDrawer> itself. The drawer isn't on every page (not
// on the cart or checkout, where it would cover the cart it summarises), so
// callers ask showAddedToCart() and fall back to a toast when nobody is there
// to open.
export const useCartDrawer = create((set) => ({
  open: false,
  addedId: null,
  mounted: false,
  // What had focus when it opened (the + or the header button). Radix only
  // hands focus back to its own trigger, and this drawer is opened from code,
  // so without this a keyboard user lands at the top of the page on close.
  returnTo: null,
  show: (addedId = null) =>
    set({
      open: true,
      addedId,
      returnTo: typeof document === 'undefined' ? null : document.activeElement,
    }),
  setOpen: (open) => set({ open }),
  setMounted: (mounted) => set({ mounted }),
}))

// Open the drawer on the product just added. Returns false when there's no
// drawer on this page, so the caller can confirm the add another way.
export function showAddedToCart(id) {
  const drawer = useCartDrawer.getState()
  if (!drawer.mounted) return false
  drawer.show(id)
  return true
}

// Open the drawer from the header's cart button. Same contract.
export function showCart() {
  const drawer = useCartDrawer.getState()
  if (!drawer.mounted) return false
  drawer.show(null)
  return true
}
