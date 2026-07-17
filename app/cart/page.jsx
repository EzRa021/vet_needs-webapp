"use client"

import Image from "next/image"
import Link from "next/link"
import { Trash2, ArrowRight, ShoppingBag, ShieldCheck, Truck } from 'lucide-react'
import CheckoutSteps from "@/components/checkout-steps"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { useCartStore, maxQuantityFor } from "@/stores/cartStore"
import { useCartSync } from "@/stores/cartSync"
import { useCheckoutStore } from "@/stores/checkoutStore"
import { useStoreSettings, useShippingQuote } from "@/stores/shopStore"
import { useDefaultAddress } from "@/stores/addressStore"
import CartChangesNotice from "@/components/cart-changes-notice"
import CouponInput from "@/components/coupon-input"
import QuantityInput from "@/components/quantity-input"
import { formatQuantity } from "@/lib/units"
import { Progress } from "@/components/ui/progress"
import { formatNaira } from "@/lib/pricing"

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, getCartTotals } = useCartStore()
  const coupon = useCheckoutStore((s) => s.coupon)
  const { pricingConfig } = useStoreSettings()
  // Refresh the cart against the live catalogue: a localStorage cart can be
  // weeks old, and its prices/stock with it.
  const { changes, dismiss, hasBlockers } = useCartSync()

  // The cart doesn't know the destination — but if they're signed in with a
  // default address, it does. Quoting that state beats showing the nationwide
  // rate and then changing the number at checkout: a total that moves after
  // you've decided to buy is the thing shoppers actually resent.
  const defaultAddress = useDefaultAddress()
  const quoteState = defaultAddress?.state || null
  const { data: quote } = useShippingQuote(quoteState)

  const shippingConfig = quote
    ? { shippingFlat: quote.fee, freeShippingOver: quote.free_over }
    : pricingConfig

  // Preview only — the server recomputes discount + shipping from the order's
  // own state when it's created.
  const totals = getCartTotals({ discount: coupon?.discount || 0, ...shippingConfig })

  return (
    <div className="container px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Cart</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <ShoppingBag className="mx-auto mb-4 h-14 w-14 text-muted-foreground/40" />
          <h2 className="text-2xl font-semibold">Your cart is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Looks like you haven't added any products yet. Your pet is waiting! 🐾
          </p>
          <Button className="mt-6" size="lg" asChild>
            <Link href="/shop">
              Start Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
        <CheckoutSteps current={0} />
        <CartChangesNotice changes={changes} onDismiss={dismiss} />
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="rounded-lg border bg-card">
              <div className="p-6">
                <div className="hidden md:grid grid-cols-12 gap-4 pb-4 text-sm font-medium text-muted-foreground">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Price</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>
                <Separator />
                {items.map((item, index) => {
                  const max = maxQuantityFor(item)
                  const atMax = max !== null && item.quantity >= max
                  return (
                  <div key={item.id}>
                    <div className={`py-6 ${item.unavailable ? "opacity-60" : ""}`}>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="col-span-6 flex items-center gap-4">
                          <div className="relative h-20 w-20 rounded-md overflow-hidden bg-muted">
                            {item.image ? (
                              <Image 
                                src={item.image} 
                                alt={item.name} 
                                fill 
                                className="object-cover" 
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{item.name}</h3>
                            {item.unavailable ? (
                              <p className="text-sm font-medium text-destructive">
                                {item.unavailableReason === "out_of_stock"
                                  ? "Sold out"
                                  : "No longer available"}{" "}
                                — remove to check out
                              </p>
                            ) : (
                              atMax && (
                                <p className="text-xs text-muted-foreground">
                                  Only {formatQuantity(max, item.unit_type)} left
                                </p>
                              )
                            )}
                            <p className="text-sm text-muted-foreground md:hidden">
                              {formatNaira(item.price)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-auto p-0 text-sm text-destructive hover:text-destructive/80 md:hidden"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Remove
                            </Button>
                          </div>
                        </div>
                        <div className="col-span-2 text-center hidden md:block">
                          {formatNaira(item.price)}
                        </div>
                        <div className="col-span-2 flex items-center justify-center">
                          {/* max stops the shopper building an order that
                              create-order would reject with a 409 at the very
                              last step. */}
                          <QuantityInput
                            value={item.quantity}
                            onChange={(q) => updateQuantity(item.id, q)}
                            unitType={item.unit_type}
                            max={max}
                            size="sm"
                            disabled={item.unavailable}
                          />
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-between md:justify-end">
                          <span className="font-medium">
                            {formatNaira(item.price * item.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive/80 hidden md:inline-flex"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                    {index < items.length - 1 && <Separator />}
                  </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between bg-muted p-6 rounded-b-lg">
                <Button variant="outline" asChild>
                  <Link href="/shop">Continue Shopping</Link>
                </Button>
                <Button variant="ghost" onClick={clearCart}>
                  Clear Cart
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatNaira(totals.subtotal)}</span>
                  </div>

                  <CouponInput />

                  {totals.discount > 0 && (
                    <div className="flex items-center justify-between text-success">
                      <span>Discount {coupon?.code ? `(${coupon.code})` : ""}</span>
                      <span className="tabular-nums">−{formatNaira(totals.discount)}</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Shipping</span>
                      {/* Say what the number is based on. Without this it reads
                          as a fixed price, and changing it at checkout looks
                          like a bait-and-switch rather than a better estimate. */}
                      <span className="text-xs text-muted-foreground">
                        {quoteState
                          ? `Estimated for ${quoteState}`
                          : "Confirmed at checkout"}
                      </span>
                    </div>
                    {totals.freeShipping.qualifies ? (
                      <span className="font-medium text-success">Free</span>
                    ) : (
                      <span className="tabular-nums">{formatNaira(totals.shipping)}</span>
                    )}
                  </div>

                  {/* Free-delivery nudge, driven by the admin's threshold */}
                  {totals.freeShipping.enabled && (
                    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-3">
                      {totals.freeShipping.qualifies ? (
                        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                          <Truck className="size-4" />
                          You&apos;ve earned free delivery
                        </p>
                      ) : (
                        <>
                          <p className="text-sm">
                            Add{" "}
                            <span className="font-semibold tabular-nums">
                              {formatNaira(totals.freeShipping.remaining)}
                            </span>{" "}
                            more for free delivery
                          </p>
                          <Progress
                            value={Math.min(
                              100,
                              ((totals.subtotal - totals.discount) /
                                totals.freeShipping.threshold) *
                                100
                            )}
                          />
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">VAT</span>
                    <span>
                      {totals.tax > 0
                        ? formatNaira(totals.tax)
                        : totals.includedTax > 0
                          ? `Included (${formatNaira(totals.includedTax)})`
                          : formatNaira(0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-medium text-lg">
                    <span>Total</span>
                    <span>{formatNaira(totals.total)}</span>
                  </div>

                  <div className="pt-4">
                    {hasBlockers ? (
                      <>
                        <Button className="w-full" size="lg" disabled>
                          Proceed to Checkout
                        </Button>
                        <p className="mt-2 text-center text-xs text-destructive">
                          Remove the unavailable items above to continue.
                        </p>
                      </>
                    ) : (
                      <Button className="w-full" size="lg" asChild>
                        <Link href="/checkout">
                          Proceed to Checkout
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      Secure checkout powered by Paystack
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
