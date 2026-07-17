"use client"

import { Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Truck, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import FulfilmentTimeline from "@/components/fulfilment-timeline"
import { createClient } from "@/lib/supabase/client"
import { formatNaira } from "@/lib/pricing"
import { formatQuantity } from "@/lib/units"
import { statusMeta } from "@/lib/order-status"
import { LEGAL } from "@/lib/legal"

// Guest order tracking: /order/<id>?token=<guest_token>
//
// This is the link that goes in a guest's confirmation email — the only way to
// see an order without an account. The token IS the authorisation: RLS can't
// help here, because a guest order has user_id null and "users read own orders"
// (`auth.uid() = user_id`) can never match it. get_guest_order() checks the
// token server-side and stops returning anything once the order is claimed by
// an account, so an old link doesn't outlive the claim.
const useGuestOrder = (id, token) =>
  useQuery({
    queryKey: ["guest-order", id, token],
    enabled: !!id && !!token,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("get_guest_order", {
        p_order_id: id,
        p_token: token,
      })
      if (error) throw error
      return Array.isArray(data) ? data[0] || null : data
    },
  })

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

function Shell({ children }) {
  return <div className="container mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">{children}</div>
}

function GuestOrderContent() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { data: order, isLoading, isError } = useGuestOrder(id, token)

  if (!token) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>This link is incomplete</AlertTitle>
          <AlertDescription>
            Order links include a private code. Please use the full link from your
            confirmation email — or sign in, if you placed this order with an
            account.
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/account/orders">Sign in to my orders</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="mb-4 h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </Shell>
    )
  }

  // A wrong/expired token and a nonexistent order are deliberately the same
  // answer — this page is public, so it must not confirm which orders exist.
  if (isError || !order) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>We couldn&apos;t find that order</AlertTitle>
          <AlertDescription>
            The link may be wrong or out of date. If you have since created an
            account with the same email, this order now lives in your account —
            sign in to see it.
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/account/orders">Sign in</Link>
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

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.created_at)}
            {order.paid_at && ` · Paid on ${formatDate(order.paid_at)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-3.5" />
          Print
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-5">
          <FulfilmentTimeline status={order.status} />
          <p className="text-center text-sm text-muted-foreground">{meta.description}</p>
          {order.tracking_number && (
            <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <Truck className="size-4 shrink-0 text-primary" />
              Tracking:{" "}
              <span className="font-mono font-medium">{order.tracking_number}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="hidden print:block">
            <p className="font-display text-lg font-bold">{LEGAL.brand}</p>
            <p className="text-xs text-muted-foreground">{LEGAL.supportEmail}</p>
            <Separator className="my-3" />
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {formatQuantity(item.quantity, item.unit_type)} @ {formatNaira(item.price)}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatNaira(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-1.5 text-sm">
            {order.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatNaira(order.subtotal)}</span>
              </div>
            )}
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-primary">
                <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                <span className="tabular-nums">−{formatNaira(order.discount_amount)}</span>
              </div>
            )}
            {order.shipping_fee != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="tabular-nums">
                  {Number(order.shipping_fee) === 0 ? "Free" : formatNaira(order.shipping_fee)}
                </span>
              </div>
            )}
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span className="tabular-nums">{formatNaira(order.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatNaira(order.total_amount)}</span>
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

      <p className="mt-6 text-center text-sm text-muted-foreground print:hidden">
        Placed this as a guest?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Create an account
        </Link>{" "}
        with <span className="font-medium text-foreground">{order.email}</span> and this
        order moves into it automatically.
      </p>
    </Shell>
  )
}

export default function GuestOrderPage() {
  return (
    <Suspense fallback={<Shell><Skeleton className="h-64 w-full rounded-xl" /></Shell>}>
      <GuestOrderContent />
    </Suspense>
  )
}
