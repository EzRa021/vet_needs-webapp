"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Check, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useCartStore } from "@/stores/cartStore"
import { useCheckoutStore } from "@/stores/checkoutStore"
import CheckoutSteps from "@/components/checkout-steps"
import FulfilmentTimeline from "@/components/fulfilment-timeline"
import { createClient } from "@/lib/supabase/client"
import { formatNaira } from "@/lib/pricing"
import { statusMeta, isTerminal } from "@/lib/order-status"

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

function useOrder(orderId, guestToken) {
  return useQuery({
    queryKey: ["order", orderId, guestToken],
    enabled: !!orderId,
    queryFn: async () => {
      const supabase = createClient()

      // A guest order has user_id null, so the "users read own orders" policy
      // (`auth.uid() = user_id`) can never match it — no session can read one.
      // The token is the capability, and get_guest_order() is the only door.
      if (guestToken) {
        const { data, error } = await supabase.rpc("get_guest_order", {
          p_order_id: orderId,
          p_token: guestToken,
        })
        if (error) throw error
        return Array.isArray(data) ? data[0] || null : data
      }

      // RLS scopes this to the buyer's own orders, so an id in the URL is not
      // enough to read someone else's order.
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, status, total_amount, subtotal, shipping_fee, tax_amount, discount_amount, order_items, shipping_address, tracking_number"
        )
        .eq("id", orderId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

function Shell({ children }) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">{children}</div>
  )
}

export default function OrderSuccessPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const guestToken = searchParams.get("token")
  const clearCart = useCartStore((state) => state.clearCart)
  const resetCheckout = useCheckoutStore((state) => state.resetCheckout)
  const cleared = useRef(false)

  useEffect(() => {
    // Reaching this page means /checkout/verify confirmed payment with Paystack,
    // so the cart is safe to empty. The ref keeps a re-render from wiping a cart
    // the shopper has since started filling again.
    if (!orderId || cleared.current) return
    cleared.current = true
    clearCart()
    resetCheckout()
  }, [orderId, clearCart, resetCheckout])

  const { data: order, isLoading, isError } = useOrder(orderId, guestToken)

  if (!orderId) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>No order to show</AlertTitle>
          <AlertDescription>
            This page needs an order reference. If you have just paid, your order is
            safe — open your order history to see it.
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/account/orders">View my orders</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  if (isLoading) {
    return (
      <Shell>
        <CheckoutSteps current={4} />
        <Skeleton className="mx-auto mb-4 size-16 rounded-full" />
        <Skeleton className="mx-auto mb-8 h-8 w-64" />
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </Shell>
    )
  }

  // isError = the query failed. !order = RLS returned nothing, i.e. the id is
  // wrong or belongs to someone else. Either way we must not claim success.
  if (isError || !order) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>We could not load this order</AlertTitle>
          <AlertDescription>
            {isError
              ? "Something went wrong fetching it. Your payment is not affected."
              : "This order does not exist, or it belongs to a different account. Try signing in with the account you ordered from."}
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/account/orders">View my orders</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  const items = Array.isArray(order.order_items) ? order.order_items : []
  const meta = statusMeta(order.status)
  const paid = !isTerminal(order.status) && order.status !== "pending"

  return (
    <Shell>
      <CheckoutSteps current={4} />

      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-8" />
        </div>
        <h1 className="mb-2 font-display text-3xl font-bold">
          {paid ? "Order confirmed" : "Order received"}
        </h1>
        <p className="text-muted-foreground">{meta.description}</p>
      </div>

      <Card className="mb-8">
        <CardContent className="grid gap-6 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                Order #{order.id.slice(0, 8).toUpperCase()}
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </h2>
              <p className="text-sm text-muted-foreground">
                Placed on {formatDate(order.created_at)}
              </p>
            </div>
            {/* A guest has no order history to send them to — their link IS the
                order. Point them at the durable one instead of a login wall. */}
            <Button asChild>
              {guestToken ? (
                <Link href={`/order/${order.id}?token=${guestToken}`}>
                  Track this order
                </Link>
              ) : (
                <Link href={`/account/orders/${order.id}`}>View order details</Link>
              )}
            </Button>
          </div>

          <Separator />

          <FulfilmentTimeline status={order.status} />

          <Separator />

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {item.quantity}
                    {item.unit_type === "kg" ? " kg" : " ×"} @ {formatNaira(item.price)}
                  </p>
                </div>
                <p className="font-medium">{formatNaira(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-1.5 text-sm">
            {order.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatNaira(order.subtotal)}</span>
              </div>
            )}
            {order.discount_amount != null && Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-primary">
                <span>Discount</span>
                <span>−{formatNaira(order.discount_amount)}</span>
              </div>
            )}
            {order.shipping_fee != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {Number(order.shipping_fee) === 0 ? "Free" : formatNaira(order.shipping_fee)}
                </span>
              </div>
            )}
            {order.tax_amount != null && Number(order.tax_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span>{formatNaira(order.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-semibold">
              <span>Total paid</span>
              <span>{formatNaira(order.total_amount)}</span>
            </div>
          </div>

          {order.shipping_address && (
            <>
              <Separator />
              <div>
                <p className="mb-1 text-sm font-medium">Delivering to</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {order.shipping_address}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 text-center">
        <h2 className="font-display text-xl font-semibold">What happens next</h2>
        <p className="mx-auto max-w-md text-muted-foreground">
          {guestToken
            ? "We'll email you when your order is packed and on its way. Keep that email — it has your private link to this order."
            : "We will email you when your order is packed and on its way. You can follow its progress any time from your order history."}
        </p>
        {guestToken && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Want it in an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register with the same email
            </Link>{" "}
            and this order moves across automatically.
          </p>
        )}
        <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Need help?</Link>
          </Button>
        </div>
      </div>
    </Shell>
  )
}
