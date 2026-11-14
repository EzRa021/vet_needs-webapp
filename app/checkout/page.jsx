"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CircleAlert, Loader2, Store, Truck } from "lucide-react"
import { formatNaira } from "@/lib/pricing"
import { NIGERIAN_STATES, formatAddress } from "@/lib/nigeria"
import { formatWeight } from "@/lib/delivery"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import CheckoutSteps from "@/components/checkout-steps"
import AreaPicker from "@/components/checkout/area-picker"
import LocationButton from "@/components/checkout/location-button"
import PickupPointCard from "@/components/pickup-point-card"
import { useDeliveryOptions, useDeliveryQuote } from "@/stores/shopStore"
import { useCartStore } from "@/stores/cartStore"
import { useCheckoutStore, useCreateOrder } from "@/stores/checkoutStore"
import {
  useAddresses,
  useDefaultAddress,
  addressToShippingInfo,
} from "@/stores/addressStore"
import { useUser } from "@/stores/authStore"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

const sameText = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase()

// A choice card: the whole card is the label, so the tap target is the card,
// not the 16px radio dot.
function MethodOption({ value, id, icon: Icon, title, description }) {
  return (
    <FieldLabel
      htmlFor={id}
      className="cursor-pointer has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
    >
      <Field orientation="horizontal">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <FieldContent>
          <FieldTitle>{title}</FieldTitle>
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
        <RadioGroupItem value={value} id={id} />
      </Field>
    </FieldLabel>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: user, isLoading: userLoading } = useUser()

  const { items, getCartTotals } = useCartStore()
  const {
    shippingInfo,
    delivery,
    orderNotes,
    coupon,
    idempotencyKey,
    updateShippingInfo,
    updateDelivery,
    setOrderNotes,
    syncCartSignature,
  } = useCheckoutStore()

  const { data: addressList } = useAddresses()
  const addresses = addressList || []
  const defaultAddress = useDefaultAddress()
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [showErrors, setShowErrors] = useState(false)
  const prefilled = useRef(false)

  const createOrder = useCreateOrder()

  // ---- Delivery choices (028) -------------------------------------------
  const { data: options, isLoading: optionsLoading } = useDeliveryOptions()
  const pickupPoints = options?.pickupPoints || []
  const canPickup = pickupPoints.length > 0
  const method = canPickup && delivery.method === "pickup" ? "pickup" : "delivery"
  const pickupPoint = pickupPoints.find((p) => p.id === delivery.pickupPointId) || null

  // Areas are offered for the chosen state only, and only while area pricing
  // is on (options.cities is empty when it's off).
  const stateCities = (options?.cities || []).filter((c) => sameText(c.state, shippingInfo.state))
  const needsArea = method === "delivery" && stateCities.length > 0

  // A remembered choice can go stale (staff removed the area, or the state
  // changed); treat a key that no longer matches anything as "not chosen".
  const areaKey = (() => {
    if (!needsArea) return ""
    const k = delivery.areaKey
    if (k === "state") return k
    if (k.startsWith("city:")) {
      return stateCities.some((c) => c.hasFallback && sameText(c.city, k.slice(5))) ? k : ""
    }
    if (k.startsWith("area:")) {
      const id = k.slice(5)
      return stateCities.some((c) => c.areas.some((a) => a.id === id)) ? k : ""
    }
    return ""
  })()
  const showCityInput = method === "delivery" && (!needsArea || areaKey === "state")

  // Typing a town re-quotes, but not on every keystroke.
  const debouncedCity = useDebounce(shippingInfo.city, 500)

  const quoteReady =
    method === "pickup"
      ? Boolean(pickupPoint)
      : Boolean(shippingInfo.state) && (!needsArea || Boolean(areaKey))

  const {
    data: quoteData,
    isFetching: quoting,
    isPlaceholderData,
    isError: quoteFailed,
    refetch: retryQuote,
  } = useDeliveryQuote(
    {
      items,
      method,
      pickupPointId: pickupPoint?.id,
      state: shippingInfo.state,
      areaKey,
      // Only matters on the "somewhere else in the state" path (see quoteDelivery).
      city: method === "delivery" && areaKey === "state" ? debouncedCity : null,
    },
    { enabled: quoteReady && !optionsLoading }
  )
  // Never show a quote for a different choice than the one on screen.
  const quote = quoteReady && !isPlaceholderData ? quoteData : null
  const deliveryKnown = quote?.ok === true

  // Until delivery is known it is left out of the total rather than guessed —
  // a number that jumps at the last step is what shoppers resent.
  const totals = getCartTotals({
    discount: coupon?.discount || 0,
    ...(deliveryKnown
      ? { shippingFlat: quote.fee, freeShippingOver: quote.free_over }
      : { shippingFlat: 0, freeShippingOver: null }),
  })

  // One pickup point: choose it for them.
  useEffect(() => {
    if (method === "pickup" && !pickupPoint && pickupPoints.length > 0) {
      updateDelivery({ pickupPointId: pickupPoints[0].id })
    }
  }, [method, pickupPoint, pickupPoints, updateDelivery])

  // Guests may check out (011) — no login redirect. Signing in is offered as a
  // convenience below, never as a toll gate: forcing account creation on a
  // first-time buyer is the classic way to lose the sale.

  // The first render after a full page load is React hydrating the server's
  // HTML, and zustand hands it the store's INITIAL state — an empty cart — not
  // what's in localStorage. Acting on that sent anyone who refreshed checkout
  // back to the cart. Wait one commit for the real cart.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  useEffect(() => {
    if (hydrated && items.length === 0) {
      router.push('/cart')
    }
  }, [hydrated, items.length, router])

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

  // What the shopper is buying, and how it reaches them. If any of it changes,
  // the next submit is a different order and needs its own idempotency key —
  // otherwise the server would treat it as a retry and hand back the earlier,
  // now-stale order. The coupon changes what gets charged; so does the
  // delivery choice (028): switching to pickup must not return the delivery
  // order created a minute ago.
  const cartSignature = `${items
    .map((i) => `${i.id}:${i.quantity}`)
    .sort()
    .join('|')}#${coupon?.code || ''}#${method}|${pickupPoint?.id || ''}|${shippingInfo.state || ''}|${areaKey}`

  useEffect(() => {
    syncCartSignature(cartSignature)
  }, [cartSignature, syncCartSignature])

  // Prefill from the saved default address, once. Guarded by a ref rather than
  // an empty-form check so it can't fight a customer who deliberately clears a
  // field, and skipped entirely if they've already typed something.
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
    // A different address is a different area; make them pick again rather
    // than keep a price for somewhere else.
    updateDelivery({ areaKey: "" })
    if (value === "new") {
      // Clear the address fields but keep who they are — retyping your own name
      // to use a second address would be silly.
      updateShippingInfo({ address: "", address2: "", landmark: "", city: "", state: "", zip: "" })
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

  const handleStateChange = (value) => {
    // The area belonged to the old state; so did a city the area filled in.
    const cityWasFromArea = delivery.areaKey.startsWith("area:") || delivery.areaKey.startsWith("city:")
    updateShippingInfo({ state: value, ...(cityWasFromArea ? { city: "" } : {}) })
    updateDelivery({ areaKey: "" })
  }

  const handleAreaChange = (key) => {
    updateDelivery({ areaKey: key })
    if (key.startsWith("area:")) {
      const id = key.slice(5)
      const c = stateCities.find((x) => x.areas.some((a) => a.id === id))
      if (c) updateShippingInfo({ city: c.city })
    } else if (key.startsWith("city:")) {
      updateShippingInfo({ city: key.slice(5) })
    } else if (stateCities.some((c) => sameText(c.city, shippingInfo.city))) {
      // "Somewhere else in the state": a city we filled in is now wrong.
      updateShippingInfo({ city: "" })
    }
  }

  // Field-level problems, shown once they've tried to continue.
  const missing = {
    firstName: !shippingInfo.firstName,
    lastName: !shippingInfo.lastName,
    email: !shippingInfo.email,
    phone: !shippingInfo.phone,
    address: method === "delivery" && !shippingInfo.address,
    state: method === "delivery" && !shippingInfo.state,
    area: needsArea && !areaKey,
    city: showCityInput && !shippingInfo.city,
  }
  const invalid = (field) => showErrors && missing[field]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setShowErrors(true)

    if (Object.values(missing).some(Boolean)) {
      toast({
        title: "Missing information",
        description: missing.area
          ? "Choose your area so we can work out delivery."
          : "Fill in the fields marked in red.",
        variant: "destructive",
      })
      return
    }

    if (!deliveryKnown) {
      toast({
        title: method === "pickup" ? "Can't confirm pickup yet" : "Can't price delivery yet",
        description: quote?.reason || "We're still working out the delivery price. Try again in a moment.",
        variant: "destructive",
      })
      return
    }

    try {
      // Only ids + quantities are sent — the server looks up real prices and
      // weights. The coupon is sent as a code only, and the delivery as a
      // choice: the server works out both amounts itself.
      await createOrder.mutateAsync({
        items: items.map(item => ({
          id: item.id,
          quantity: item.quantity,
        })),
        shippingInfo,
        delivery: {
          method,
          pickupPointId: pickupPoint?.id || null,
          areaKey,
          location: method === "delivery" ? delivery.location : null,
        },
        orderNotes,
        couponCode: coupon?.code || null,
        // Stable across a double-click, so the server returns the first order
        // rather than creating a second.
        idempotencyKey,
      })

      router.push('/checkout/review')
    } catch (error) {
      toast({
        title: "Couldn't create your order",
        description: error.message || "Failed to create order",
        variant: "destructive",
      })
    }
  }

  // What the summary says under "Delivery".
  const deliveryNote = (() => {
    if (method === "pickup") return pickupPoint ? `Collect from ${pickupPoint.name}` : "Choose a store"
    if (!shippingInfo.state) return "Choose your state to see the price"
    if (needsArea && !areaKey) return "Choose your area to see the price"
    if (!quote?.ok) return null
    const place =
      quote.area_name ||
      (quote.matched_by === "city" && quote.city ? `Elsewhere in ${quote.city}` : shippingInfo.state)
    return `${place} · ${formatWeight(quote.weight_kg)}`
  })()

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

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 flex flex-col gap-8">
            {/* Delivery or pickup. Only a question when there's a store to
                collect from — otherwise it's just delivery. */}
            {canPickup && (
              <section className="bg-card rounded-lg border p-6" aria-labelledby="method-heading">
                <h2 id="method-heading" className="text-xl font-semibold mb-4">Delivery or pickup</h2>
                <RadioGroup
                  value={method}
                  onValueChange={(v) => updateDelivery({ method: v })}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <MethodOption
                    value="delivery"
                    id="method-delivery"
                    icon={Truck}
                    title="Deliver to me"
                    description="Priced by your area and how heavy the order is"
                  />
                  <MethodOption
                    value="pickup"
                    id="method-pickup"
                    icon={Store}
                    title="Collect from our store"
                    description={
                      pickupPoints.length === 1
                        ? `${pickupPoints[0].name}, ${pickupPoints[0].city} — ${
                            Number(pickupPoints[0].fee) > 0 ? formatNaira(pickupPoints[0].fee) : "free"
                          }`
                        : "Choose a store below"
                    }
                  />
                </RadioGroup>
              </section>
            )}

            {/* Saved addresses. Only worth showing if there are any — a picker
                with one option ("Enter a new address") is just noise. */}
            {method === "delivery" && addresses.length > 0 && (
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

            <section className="bg-card rounded-lg border p-6" aria-labelledby="details-heading">
              <h2 id="details-heading" className="text-xl font-semibold mb-4">
                {method === "pickup" ? "Who's collecting" : "Delivery address"}
              </h2>
              <FieldGroup>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field data-invalid={invalid("firstName") || undefined}>
                    <FieldLabel htmlFor="first-name">First name *</FieldLabel>
                    <Input
                      id="first-name"
                      autoComplete="given-name"
                      value={shippingInfo.firstName}
                      onChange={(e) => handleShippingChange('firstName', e.target.value)}
                      aria-invalid={invalid("firstName") || undefined}
                    />
                  </Field>
                  <Field data-invalid={invalid("lastName") || undefined}>
                    <FieldLabel htmlFor="last-name">Last name *</FieldLabel>
                    <Input
                      id="last-name"
                      autoComplete="family-name"
                      value={shippingInfo.lastName}
                      onChange={(e) => handleShippingChange('lastName', e.target.value)}
                      aria-invalid={invalid("lastName") || undefined}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field data-invalid={invalid("email") || undefined}>
                    <FieldLabel htmlFor="email">Email *</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={shippingInfo.email}
                      onChange={(e) => handleShippingChange('email', e.target.value)}
                      aria-invalid={invalid("email") || undefined}
                    />
                  </Field>
                  <Field data-invalid={invalid("phone") || undefined}>
                    <FieldLabel htmlFor="phone">Phone *</FieldLabel>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={shippingInfo.phone}
                      onChange={(e) => handleShippingChange('phone', e.target.value)}
                      aria-invalid={invalid("phone") || undefined}
                    />
                    <FieldDescription>
                      {method === "pickup"
                        ? "We'll call this number if there's a problem with your order."
                        : "The rider will call this number when they're close."}
                    </FieldDescription>
                  </Field>
                </div>

                {method === "pickup" ? (
                  <>
                    {pickupPoints.length > 1 && (
                      <Field>
                        <FieldLabel htmlFor="pickup-point">Store *</FieldLabel>
                        <Select
                          value={pickupPoint?.id || ""}
                          onValueChange={(v) => updateDelivery({ pickupPointId: v })}
                        >
                          <SelectTrigger id="pickup-point">
                            <SelectValue placeholder="Choose a store" />
                          </SelectTrigger>
                          <SelectContent>
                            {pickupPoints.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}, {p.city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    <PickupPointCard point={pickupPoint} />
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll email you when your order is ready, with a pickup code to show
                      at the store.
                    </p>
                  </>
                ) : (
                  <>
                    <Field data-invalid={invalid("state") || undefined}>
                      <FieldLabel htmlFor="state">State *</FieldLabel>
                      <Select value={shippingInfo.state} onValueChange={handleStateChange}>
                        <SelectTrigger id="state" aria-invalid={invalid("state") || undefined}>
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
                    </Field>

                    {needsArea && (
                      <Field data-invalid={invalid("area") || undefined}>
                        <FieldLabel htmlFor="area">Area *</FieldLabel>
                        <AreaPicker
                          id="area"
                          value={areaKey}
                          onChange={handleAreaChange}
                          cities={stateCities}
                          state={shippingInfo.state}
                          invalid={invalid("area")}
                        />
                        <FieldDescription>
                          The delivery price depends on your area.
                        </FieldDescription>
                      </Field>
                    )}

                    <Field data-invalid={invalid("address") || undefined}>
                      <FieldLabel htmlFor="address">Street address *</FieldLabel>
                      <Input
                        id="address"
                        autoComplete="address-line1"
                        placeholder="House number and street"
                        value={shippingInfo.address}
                        onChange={(e) => handleShippingChange('address', e.target.value)}
                        aria-invalid={invalid("address") || undefined}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="address2">Apartment, estate, etc. (optional)</FieldLabel>
                      <Input
                        id="address2"
                        autoComplete="address-line2"
                        value={shippingInfo.address2}
                        onChange={(e) => handleShippingChange('address2', e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="landmark">Nearest landmark (optional)</FieldLabel>
                      <Input
                        id="landmark"
                        placeholder="e.g. Opposite Bodija market, beside the filling station"
                        value={shippingInfo.landmark || ""}
                        onChange={(e) => handleShippingChange('landmark', e.target.value)}
                        maxLength={200}
                      />
                      <FieldDescription>Helps the rider find you faster.</FieldDescription>
                    </Field>

                    <div className={cn("grid grid-cols-1 gap-4", showCityInput && "sm:grid-cols-2")}>
                      {showCityInput && (
                        <Field data-invalid={invalid("city") || undefined}>
                          <FieldLabel htmlFor="city">City or town *</FieldLabel>
                          <Input
                            id="city"
                            autoComplete="address-level2"
                            value={shippingInfo.city}
                            onChange={(e) => handleShippingChange('city', e.target.value)}
                            aria-invalid={invalid("city") || undefined}
                          />
                        </Field>
                      )}
                      <Field>
                        <FieldLabel htmlFor="zip">Postal code (optional)</FieldLabel>
                        <Input
                          id="zip"
                          autoComplete="postal-code"
                          value={shippingInfo.zip}
                          onChange={(e) => handleShippingChange('zip', e.target.value)}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Your location</FieldLabel>
                      <LocationButton
                        value={delivery.location}
                        onChange={(location) => updateDelivery({ location })}
                      />
                    </Field>
                  </>
                )}
              </FieldGroup>
            </section>

            {/* No billing address section: Paystack hosts the card form and
                collects whatever it needs there, so asking for one here would
                be collecting data nothing reads. */}

            <div className="bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Order notes (optional)</h2>
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  placeholder={
                    method === "pickup"
                      ? "Anything we should know before you collect"
                      : "Special instructions for delivery"
                  }
                  className="min-h-[100px]"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="sticky top-20 bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">Order summary</h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatNaira(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex items-center justify-between text-success">
                    <span>Discount {coupon?.code ? `(${coupon.code})` : ""}</span>
                    <span className="tabular-nums">−{formatNaira(totals.discount)}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground">
                      {method === "pickup" ? "Pickup" : "Delivery"}
                    </span>
                    {/* Say what the price is based on. A fee that changes when
                        you pick an area looks arbitrary unless you say why. */}
                    {deliveryNote && (
                      <span className="text-xs text-muted-foreground">{deliveryNote}</span>
                    )}
                    {method === "delivery" && quote?.ok && quote.estimate && (
                      <span className="text-xs text-muted-foreground">{quote.estimate}</span>
                    )}
                  </div>
                  {quoteReady && quoting && !quote ? (
                    <Spinner className="text-muted-foreground" aria-label="Working out delivery" />
                  ) : deliveryKnown ? (
                    totals.shipping === 0 ? (
                      <span className="font-medium text-success">Free</span>
                    ) : (
                      <span className="tabular-nums">{formatNaira(totals.shipping)}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground" aria-label="Not worked out yet">—</span>
                  )}
                </div>

                {/* Not an error — a limit with a way forward — so it isn't red. */}
                {quote && !quote.ok && (
                  <Alert>
                    <CircleAlert />
                    <AlertDescription className="flex flex-col gap-2">
                      <span>{quote.reason}</span>
                      {method === "delivery" && canPickup && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => updateDelivery({ method: "pickup" })}
                        >
                          Collect from our store instead
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {quoteReady && quoteFailed && !quote && (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertDescription className="flex flex-col gap-2">
                      <span>Couldn&apos;t work out the delivery price.</span>
                      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => retryQuote()}>
                        Try again
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span className="tabular-nums">
                    {totals.tax > 0
                      ? formatNaira(totals.tax)
                      : totals.includedTax > 0
                        ? `Included (${formatNaira(totals.includedTax)})`
                        : formatNaira(0)}
                  </span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between font-medium text-lg">
                    <span>{deliveryKnown ? "Total" : "Total so far"}</span>
                    <span className="tabular-nums">{formatNaira(totals.total)}</span>
                  </div>
                  {!deliveryKnown && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {method === "pickup" ? "Pickup" : "Delivery"} is added once it&apos;s worked out.
                    </p>
                  )}
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={createOrder.isPending || (quoteReady && quoting)}
                  >
                    {createOrder.isPending ? "Creating order…" : "Review order"}
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
