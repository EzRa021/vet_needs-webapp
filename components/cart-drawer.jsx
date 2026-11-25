"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckCircle2, ShoppingBag, Trash2, Truck, X } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import BrandImage from "@/components/brand-image"
import QuantityInput from "@/components/quantity-input"
import { useCartDrawer } from "@/stores/cartDrawerStore"
import { useCartStore, maxQuantityFor } from "@/stores/cartStore"
import { useCartSync } from "@/stores/cartSync"
import { useCheckoutStore } from "@/stores/checkoutStore"
import { useStoreSettings } from "@/stores/shopStore"
import { formatNaira, formatUnitPrice } from "@/lib/pricing"
import { formatQuantity, isKg } from "@/lib/units"
import { cn } from "@/lib/utils"

// The cart, from the side: opens when something is added (and from the
// header's cart button), so the shopper sees what's in it and can carry on
// shopping or go straight to checkout without leaving the page.
//
// Mounted by site-chrome on every storefront page except the cart and
// checkout, where it would only cover the cart it summarises.
export default function CartDrawer() {
  const open = useCartDrawer((s) => s.open)
  const setOpen = useCartDrawer((s) => s.setOpen)
  const setMounted = useCartDrawer((s) => s.setMounted)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [setMounted])

  // Back/forward while it's open: don't carry it onto the next page.
  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        hideClose
        overlayClassName="bg-black/50"
        className="flex w-[92vw] max-w-md flex-col gap-0 p-0 sm:max-w-md data-[state=closed]:duration-200 data-[state=open]:duration-300 motion-reduce:animate-none"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          const el = useCartDrawer.getState().returnTo
          if (el?.isConnected) el.focus({ preventScroll: true })
        }}
      >
        {/* Only rendered while open, so the catalogue check below runs when
            the cart is looked at, not on every page view. */}
        <DrawerBody />
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody() {
  const addedId = useCartDrawer((s) => s.addedId)
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const getCartTotals = useCartStore((s) => s.getCartTotals)
  const coupon = useCheckoutStore((s) => s.coupon)
  const { pricingConfig } = useStoreSettings()
  // A saved cart can be weeks old: refresh prices and stock before showing a
  // subtotal, the same check the cart page does.
  const { hasBlockers } = useCartSync()
  const list = useRef(null)

  // Same sums as the cart page, delivery left out (checkout works it out
  // from the area).
  const totals = getCartTotals({
    discount: coupon?.discount || 0,
    ...pricingConfig,
    shippingFlat: 0,
  })

  const added = addedId ? items.find((i) => i.id === addedId) : null

  // A long cart: bring the line that was just added into view.
  useEffect(() => {
    const box = list.current
    const line = addedId && box?.querySelector(`[data-line="${addedId}"]`)
    if (!box || !line) return
    const top = line.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + line.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - 8
    }
  }, [addedId])

  const count = items.length

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <SheetTitle className="font-display text-xl font-bold">Your cart</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {count === 0 ? "Nothing in it yet" : `${count} ${count === 1 ? "item" : "items"}`}
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" className="-mr-2 size-11 shrink-0 rounded-full">
            <X className="size-5" />
            <span className="sr-only">Close cart</span>
          </Button>
        </SheetClose>
      </div>

      {added && (
        <p
          role="status"
          className="flex items-center gap-2 border-b bg-success/10 px-5 py-2.5 text-sm font-medium text-success"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          Added to your cart
        </p>
      )}

      {count === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <ShoppingBag className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="font-semibold">Your cart is empty</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add food, treats or care products and they&apos;ll show up here.
          </p>
          <SheetClose asChild>
            <Button asChild size="lg" className="mt-2">
              <Link href="/shop">Browse the shop</Link>
            </Button>
          </SheetClose>
        </div>
      ) : (
        <>
          <ul
            ref={list}
            className="flex-1 divide-y overflow-y-auto overscroll-contain px-5"
            aria-label="Products in your cart"
          >
            {items.map((item) => (
              <CartLine
                key={item.id}
                item={item}
                justAdded={item.id === addedId}
                onQuantity={(q) => updateQuantity(item.id, q)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {totals.freeShipping.enabled && (
              totals.freeShipping.qualifies ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <Truck className="size-4" />
                  You&apos;ve earned free delivery
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm">
                    Add{" "}
                    <span className="font-semibold tabular-nums">
                      {formatNaira(totals.freeShipping.remaining)}
                    </span>{" "}
                    more for free delivery
                  </p>
                  <Progress
                    className="h-1.5"
                    value={Math.min(
                      100,
                      ((totals.subtotal - totals.discount) / totals.freeShipping.threshold) * 100
                    )}
                  />
                </div>
              )
            )}

            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">Subtotal</span>
              <span className="text-lg font-bold tabular-nums">{formatNaira(totals.subtotal)}</span>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Delivery is worked out at checkout.
            </p>

            {hasBlockers && (
              <p className="text-xs font-medium text-destructive">
                Remove the items marked unavailable to check out.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <SheetClose asChild>
                <Button variant="outline" size="lg" className="px-3" asChild>
                  <Link href="/cart">View cart</Link>
                </Button>
              </SheetClose>
              {hasBlockers ? (
                <Button size="lg" className="px-3" disabled>
                  Checkout
                </Button>
              ) : (
                <SheetClose asChild>
                  <Button size="lg" className="px-3" asChild>
                    <Link href="/checkout">Checkout</Link>
                  </Button>
                </SheetClose>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function CartLine({ item, justAdded, onQuantity, onRemove }) {
  const max = maxQuantityFor(item)
  const atMax = max !== null && item.quantity >= max
  const href = `/product/${item.id}`

  return (
    <li
      data-line={item.id}
      className={cn(
        "-mx-5 flex gap-3 px-5 py-4 transition-colors",
        justAdded && "bg-success/5",
        item.unavailable && "opacity-60"
      )}
    >
      <SheetClose asChild>
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative size-[72px] shrink-0 overflow-hidden rounded-lg border bg-white"
        >
          <BrandImage src={item.image} alt="" fill sizes="72px" className="object-contain p-1" />
        </Link>
      </SheetClose>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <SheetClose asChild>
              <Link
                href={href}
                className="line-clamp-2 text-sm font-semibold leading-5 hover:text-primary"
              >
                {item.name}
              </Link>
            </SheetClose>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {formatUnitPrice(item.price, item.unit_type)}
              {isKg(item.unit_type) ? "" : " each"}
            </p>
            {item.unavailable ? (
              <p className="mt-0.5 text-xs font-medium text-destructive">
                {item.unavailableReason === "out_of_stock" ? "Sold out" : "No longer available"}
              </p>
            ) : (
              atMax && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Only {formatQuantity(max, item.unit_type)} left
                </p>
              )
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 size-11 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <QuantityInput
            value={item.quantity}
            onChange={onQuantity}
            unitType={item.unit_type}
            max={max}
            disabled={item.unavailable}
          />
          <span className="font-semibold tabular-nums">
            {formatNaira(item.price * item.quantity)}
          </span>
        </div>
      </div>
    </li>
  )
}
