"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CircleAlert, Loader2, RotateCw, Store, Truck } from "lucide-react"
import { formatNaira } from "@/lib/pricing"
import { formatAddress } from "@/lib/nigeria"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
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

  // ---- Delivery choices (029) -------------------------------------------
  // Which ways are on is the shop's call (admin Delivery page); the area is
  // the customer's, and it decides both the door-delivery price and which
  // store a pickup comes from.
  const {
    data: options,
    isLoading: optionsLoading,
    isError: optionsFailed,
    refetch: retryOptions,
    isFetching: optionsFetching,
  } = useDeliveryOptions()
  const areas = options?.areas || []
  const stores = options?.stores || []
  const canDeliver = Boolean(options?.methods?.delivery)
  const canPickup = Boolean(options?.methods?.pickup)
  const noMethods = Boolean(options) && !canDeliver && !canPickup

  // The customer's choice — unless the shop has since switched it off.
  const method =
    delivery.method === "pickup"
      ? canPickup || !canDeliver ? "pickup" : "delivery"
      : canDeliver || !canPickup ? "delivery" : "pickup"

  // A remembered area that's gone (removed, switched off) counts as unchosen.
  const area = areas.find((a) => a.id === delivery.areaId) || null
  const areaStore = (area?.storeId && stores.find((st) => st.id === area.storeId)) || null
  // Pickup comes from the area's own store. An area without one lets the
  // customer choose; with a single store there's nothing to choose.
  const pickupStore =
    method === "pickup"
      ? areaStore ||
        stores.find((st) => st.id === delivery.pickupPointId) ||
        (stores.length === 1 ? stores[0] : null)
      : null
  const needsStoreChoice = method === "pickup" && Boolean(area) && !areaStore && stores.length > 1

  const quoteReady = Boolean(area) && (method === "delivery" || Boolean(pickupStore))

  const {
    data: quoteData,
    isFetching: quoting,
    isPlaceholderData,
    isError: quoteFailed,
    refetch: retryQuote,
  } = useDeliveryQuote(
    { method, areaId: area?.id, pickupPointId: pickupStore?.id },
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
    .join('|')}#${coupon?.code || ''}#${method}|${area?.id || ''}|${pickupStore?.id || ''}`

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
    // than keep a price for somewhere else. Saved addresses don't store one.
    updateDelivery({ areaId: "" })
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

  const handleAreaChange = (areaId) => {
    // A store picked by hand belonged to the old area's situation.
    updateDelivery({ areaId, pickupPointId: "" })
  }

  // Field-level problems, shown once they've tried to continue.
  const missing = {
    firstName: !shippingInfo.firstName,
    lastName: !shippingInfo.lastName,
    email: !shippingInfo.email,
    phone: !shippingInfo.phone,
    area: !area,
    address: method === "delivery" && !shippingInfo.address,
    store: method === "pickup" && Boolean(area) && !pickupStore,
  }
  const invalid = (field) => showErrors && missing[field]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setShowErrors(true)

    if (Object.values(missing).some(Boolean)) {
      toast({
        title: "Missing information",
        description: missing.area
          ? method === "pickup"
            ? "Choose your area so we know which store to send your order to."
            : "Choose your area so we can work out delivery."
          : missing.store
            ? "Choose the store you'll collect from."
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
          areaId: area.id,
          pickupPointId: pickupStore?.id || null,
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
    if (!area) return method === "pickup" ? "Choose your area to see your store" : "Choose your area to see the price"
    if (method === "pickup") return pickupStore ? `Collect from ${pickupStore.name}` : "Choose a store"
    return `To ${area.name}, Ibadan`
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
            {/* Nothing to choose from: the delivery choices didn't load, or the
                shop has both ways switched off. Either way, say so plainly
                instead of letting someone fill in a form they can't submit. */}
            {optionsFailed && !options && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription className="flex flex-col gap-2">
                  <span>Couldn&apos;t load the delivery options.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => retryOptions()}
                    disabled={optionsFetching}
                  >
                    <RotateCw data-icon="inline-start" />
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {noMethods && (
              <Alert>
                <CircleAlert />
                <AlertDescription>
                  We&apos;re not taking delivery or pickup orders online right now.
                  {options?.supportPhone ? ` Call us on ${options.supportPhone} to order.` : " Please check back soon."}
                </AlertDescription>
              </Alert>
            )}

            {/* Door or store. Only a question when the shop offers both — and
                held open while the options load, so the form below doesn't
                jump down when the choice appears. */}
            {optionsLoading && <Skeleton className="h-36 w-full rounded-lg" aria-hidden="true" />}
            {canDeliver && canPickup && (
              <section className="bg-card rounded-lg border p-6" aria-labelledby="method-heading">
                <h2 id="method-heading" className="text-xl font-semibold mb-4">How do you want your order?</h2>
                <RadioGroup
                  value={method}
                  onValueChange={(v) => updateDelivery({ method: v })}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <MethodOption
                    value="delivery"
                    id="method-delivery"
                    icon={Truck}
                    title="Deliver to my door"
                    description="Within Ibadan. The price depends on your area."
                  />
                  <MethodOption
                    value="pickup"
                    id="method-pickup"
                    icon={Store}
                    title="Pick up at a store"
                    description={
                      stores.length === 1
                        ? `${stores[0].name}, ${
                            Number(stores[0].fee) > 0 ? `${formatNaira(stores[0].fee)} fee` : "free"
                          }`
                        : "From the store nearest your area"
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

                {/* Compulsory either way: it prices door delivery and decides
                    which store a pickup goes to. */}
                <Field data-invalid={invalid("area") || undefined}>
                  <FieldLabel htmlFor="area">Your area in Ibadan *</FieldLabel>
                  <AreaPicker
                    id="area"
                    value={area?.id || ""}
                    onChange={handleAreaChange}
                    areas={areas}
                    stores={stores}
                    method={method}
                    invalid={invalid("area")}
                  />
                  <FieldDescription>
                    {method === "pickup"
                      ? "We'll send your order to the store nearest your area."
                      : "We deliver within Ibadan. The price depends on your area."}
                  </FieldDescription>
                </Field>

                {method === "pickup" ? (
                  <>
                    {needsStoreChoice && (
                      <Field data-invalid={invalid("store") || undefined}>
                        <FieldLabel htmlFor="pickup-point">Store *</FieldLabel>
                        <Select
                          value={pickupStore?.id || ""}
                          onValueChange={(v) => updateDelivery({ pickupPointId: v })}
                        >
                          <SelectTrigger id="pickup-point" aria-invalid={invalid("store") || undefined}>
                            <SelectValue placeholder="Choose a store" />
                          </SelectTrigger>
                          <SelectContent>
                            {stores.map((st) => (
                              <SelectItem key={st.id} value={st.id}>
                                {st.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    {pickupStore && (
                      <>
                        <PickupPointCard point={pickupStore} />
                        <p className="text-sm text-muted-foreground">
                          We&apos;ll email you when your order is ready, with a pickup code to show
                          at the store.
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
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
                    disabled={createOrder.isPending || (quoteReady && quoting) || noMethods}
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
