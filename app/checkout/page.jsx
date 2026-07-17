"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { formatNaira } from "@/lib/pricing"
import { NIGERIAN_STATES, formatAddress } from "@/lib/nigeria"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import CheckoutSteps from "@/components/checkout-steps"
import { useStoreSettings, useShippingQuote } from "@/stores/shopStore"
import { useCartStore } from "@/stores/cartStore"
import { useCheckoutStore, useCreateOrder } from "@/stores/checkoutStore"
import {
  useAddresses,
  useDefaultAddress,
  addressToShippingInfo,
} from "@/stores/addressStore"
import { useUser } from "@/stores/authStore"

export default function CheckoutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: user, isLoading: userLoading } = useUser()

  const { items, getCartTotals } = useCartStore()
  const {
    shippingInfo,
    orderNotes,
    coupon,
    idempotencyKey,
    updateShippingInfo,
    setOrderNotes,
    syncCartSignature,
  } = useCheckoutStore()

  const { data: addressList } = useAddresses()
  const addresses = addressList || []
  const defaultAddress = useDefaultAddress()
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const prefilled = useRef(false)

  const { pricingConfig } = useStoreSettings()
  const createOrder = useCreateOrder()

  // Once we know where it's going, quote the real rate for that state (014)
  // instead of the nationwide default. Falls back to the settings config while
  // the state is blank or the quote is in flight, so the summary always has
  // numbers in it.
  const { data: quote } = useShippingQuote(shippingInfo.state)
  const shippingConfig = quote
    ? { shippingFlat: quote.fee, freeShippingOver: quote.free_over }
    : pricingConfig

  const totals = getCartTotals({ discount: coupon?.discount || 0, ...shippingConfig })

  // Guests may check out (011) — no login redirect. Signing in is offered as a
  // convenience below, never as a toll gate: forcing account creation on a
  // first-time buyer is the classic way to lose the sale.

  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart')
    }
  }, [items.length, router])

  // The cart page marks lines the catalogue can no longer sell (sold out,
  // switched off, deleted) and blocks its own checkout button — but /checkout is
  // reachable directly. Without this, create-order would reject the whole order
  // at the last step; the cart page explains which product and why.
  const hasUnavailable = items.some((i) => i.unavailable)
  useEffect(() => {
    if (!hasUnavailable) return
    toast({
      title: "Some items are unavailable",
      description: "Please review your cart before checking out.",
      variant: "destructive",
    })
    router.push('/cart')
  }, [hasUnavailable, router, toast])

  // What the shopper is buying. If any of it changes, the next submit is a
  // different order and needs its own idempotency key — otherwise the server
  // would treat it as a retry and hand back the earlier, now-stale order.
  // The coupon is in here because it changes what gets charged.
  const cartSignature = `${items
    .map((i) => `${i.id}:${i.quantity}`)
    .sort()
    .join('|')}#${coupon?.code || ''}`

  useEffect(() => {
    syncCartSignature(cartSignature)
  }, [cartSignature, syncCartSignature])

  // Prefill from the saved default address, once. Guarded by a ref rather than
  // an empty-form check so it can't fight a customer who deliberately clears a
  // field, and skipped entirely if they've already typed something (the store
  // persists a half-finished checkout).
  useEffect(() => {
    if (prefilled.current || !user || !defaultAddress) return
    if (shippingInfo.address) {
      prefilled.current = true
      return
    }
    prefilled.current = true
    setSelectedAddressId(defaultAddress.id)
    updateShippingInfo(addressToShippingInfo(defaultAddress, user.email || ""))
  }, [user, defaultAddress, shippingInfo.address, updateShippingInfo])

  // Email isn't stored per-address (it's account-level), so it comes from the
  // signed-in user unless they've typed their own.
  useEffect(() => {
    if (user?.email && !shippingInfo.email) {
      updateShippingInfo({ email: user.email })
    }
  }, [user, shippingInfo.email, updateShippingInfo])

  const handleSelectAddress = (value) => {
    setSelectedAddressId(value)
    if (value === "new") {
      // Clear the address fields but keep who they are — retyping your own name
      // to use a second address would be silly.
      updateShippingInfo({ address: "", address2: "", city: "", state: "", zip: "" })
      return
    }
    const picked = addresses.find((a) => a.id === value)
    if (picked) {
      updateShippingInfo(addressToShippingInfo(picked, shippingInfo.email || user?.email || ""))
    }
  }

  // Wait for auth to resolve (rendering as a guest and then swapping to the
  // signed-in form would lose what they'd typed), but a resolved "no user" is
  // a valid state now, not a redirect.
  if (userLoading || items.length === 0) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleShippingChange = (field, value) => {
    updateShippingInfo({ [field]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate required fields (postal code is optional in Nigeria)
    if (!shippingInfo.firstName || !shippingInfo.lastName || !shippingInfo.email ||
        !shippingInfo.phone || !shippingInfo.address || !shippingInfo.city ||
        !shippingInfo.state) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required shipping fields",
        variant: "destructive",
      })
      return
    }

    // Create order
    try {
      // Only ids + quantities are sent — the server looks up real prices.
      // The coupon is sent as a code only; the server recomputes the discount.
      await createOrder.mutateAsync({
        items: items.map(item => ({
          id: item.id,
          quantity: item.quantity,
        })),
        shippingInfo,
        orderNotes,
        couponCode: coupon?.code || null,
        // Stable across a double-click, so the server returns the first order
        // rather than creating a second.
        idempotencyKey,
      })

      // Redirect to review page
      router.push('/checkout/review')
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/cart" className="hover:text-primary">Cart</Link>
          <span className="mx-2">/</span>
          <span>Checkout</span>
        </div>
      </div>

      <CheckoutSteps current={1} />

      {/* Offered, not enforced. A returning customer gets their saved addresses
          and order history; a first-time buyer is not made to create an account
          to hand over money. */}
      {!user && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
          <p className="text-sm">
            <span className="font-medium">Checking out as a guest.</span>{" "}
            <span className="text-muted-foreground">
              We&apos;ll email your receipt and a link to track this order.
            </span>
          </p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/login?redirect=/checkout">Sign in instead</Link>
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Saved addresses. Only worth showing if there are any — a picker
                with one option ("Enter a new address") is just noise. */}
            {addresses.length > 0 && (
              <div className="bg-card rounded-lg border p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Deliver to</h2>
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href="/account/addresses">Manage</Link>
                  </Button>
                </div>
                <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a saved address" />
                  </SelectTrigger>
                  <SelectContent>
                    {addresses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {(a.label ? `${a.label} — ` : "") + formatAddress(a)}
                        {a.is_default ? " (default)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">Enter a different address</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  You can still edit the details below — changes here don&apos;t
                  change your saved address.
                </p>
              </div>
            )}

            {/* Shipping Information */}
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name *</Label>
                    <Input
                      id="first-name"
                      value={shippingInfo.firstName}
                      onChange={(e) => handleShippingChange('firstName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name *</Label>
                    <Input
                      id="last-name"
                      value={shippingInfo.lastName}
                      onChange={(e) => handleShippingChange('lastName', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shippingInfo.email}
                    onChange={(e) => handleShippingChange('email', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={shippingInfo.phone}
                    onChange={(e) => handleShippingChange('phone', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={shippingInfo.address}
                    onChange={(e) => handleShippingChange('address', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address2">Apartment, suite, etc. (optional)</Label>
                  <Input
                    id="address2"
                    value={shippingInfo.address2}
                    onChange={(e) => handleShippingChange('address2', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={shippingInfo.city}
                      onChange={(e) => handleShippingChange('city', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select value={shippingInfo.state} onValueChange={(value) => handleShippingChange('state', value)}>
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIGERIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">Postal Code (optional)</Label>
                    <Input
                      id="zip"
                      value={shippingInfo.zip}
                      onChange={(e) => handleShippingChange('zip', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* No billing address section: Paystack hosts the card form and
                collects whatever it needs there, so asking for one here would
                be collecting data nothing reads. */}

            {/* Order Notes */}
            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Order Notes (Optional)</h2>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Special instructions for delivery"
                  className="min-h-[100px]"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="sticky top-20 bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatNaira(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex items-center justify-between text-success">
                    <span>Discount {coupon?.code ? `(${coupon.code})` : ""}</span>
                    <span className="tabular-nums">−{formatNaira(totals.discount)}</span>
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Shipping</span>
                    {/* Name the zone once it's known. A fee that changes when
                        you pick a state looks arbitrary unless you say why. */}
                    {quote?.zone_name && shippingInfo.state && (
                      <span className="text-xs text-muted-foreground">
                        {quote.zone_name}
                        {quote.delivery_estimate ? ` · ${quote.delivery_estimate}` : ""}
                      </span>
                    )}
                    {!shippingInfo.state && (
                      <span className="text-xs text-muted-foreground">
                        Pick a state for the exact rate
                      </span>
                    )}
                  </div>
                  {totals.freeShipping.qualifies ? (
                    <span className="font-medium text-success">Free</span>
                  ) : (
                    <span className="tabular-nums">{formatNaira(totals.shipping)}</span>
                  )}
                </div>
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
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between font-medium text-lg">
                    <span>Total</span>
                    <span>{formatNaira(totals.total)}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={createOrder.isPending}
                  >
                    {createOrder.isPending ? "Creating Order..." : "Review Order"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
