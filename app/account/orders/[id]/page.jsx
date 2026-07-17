"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Printer,
  RotateCw,
  Truck,
  AlertCircle,
  Copy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import FulfilmentTimeline from "@/components/fulfilment-timeline"
import RefundRequest from "@/components/refund-request"
import { createClient } from "@/lib/supabase/client"
import { formatNaira } from "@/lib/pricing"
import { formatQuantity } from "@/lib/units"
import { statusMeta } from "@/lib/order-status"
import { LEGAL } from "@/lib/legal"
import { useCancelOrder, useReorder } from "@/stores/orderActions"

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

const useMyOrder = (id) =>
  useQuery({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient()
      // RLS scopes this to the buyer's own orders — the id in the URL is not a
      // capability.
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, paid_at, status, total_amount, subtotal, shipping_fee, tax_amount, discount_amount, coupon_code, order_items, shipping_address, tracking_number, notes, payment_reference"
        )
        .eq("id", id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

export default function OrderTrackingPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: order, isLoading, isError } = useMyOrder(id)
  const cancel = useCancelOrder()
  const reorder = useReorder()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Order not found</AlertTitle>
          <AlertDescription>
            {isError
              ? "Something went wrong loading this order."
              : "This order doesn't exist, or it belongs to a different account."}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/account/orders">Back to my orders</Link>
        </Button>
      </div>
    )
  }

  const items = Array.isArray(order.order_items) ? order.order_items : []
  const meta = statusMeta(order.status)
  const reference = order.id.slice(0, 8).toUpperCase()

  const handleReorder = () =>
    reorder.mutate(order, {
      onSuccess: ({ added, skipped }) => {
        toast({
          title: `${added.length} ${added.length === 1 ? "item" : "items"} added to cart`,
          description: skipped.length
            ? `Not available any more: ${skipped.join(", ")}`
            : "Prices are today's — check your cart before paying.",
        })
        router.push("/cart")
      },
      onError: (err) =>
        toast({ title: "Couldn't reorder", description: err.message, variant: "destructive" }),
    })

  return (
    <div className="space-y-6">
      {/* Screen-only chrome: none of this belongs on a printed receipt. */}
      <div className="print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/account/orders">
            <ArrowLeft className="size-4" />
            All orders
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold">Order #{reference}</h2>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.created_at)}
            {order.paid_at && ` · Paid on ${formatDate(order.paid_at)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print receipt
          </Button>
          <Button variant="outline" size="sm" onClick={handleReorder} disabled={reorder.isPending}>
            <RotateCw className="size-3.5" />
            {reorder.isPending ? "Adding..." : "Buy again"}
          </Button>
          {order.status === "pending" && (
            <Button size="sm" asChild>
              <Link href={`/checkout/review?orderId=${order.id}`}>Pay now</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Where the order actually is — the reason most people open this page. */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <FulfilmentTimeline status={order.status} />
          <p className="text-center text-sm text-muted-foreground">{meta.description}</p>

          {order.tracking_number && (
            <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 p-3">
              <Truck className="size-4 shrink-0 text-primary" />
              <span className="text-sm">
                Tracking:{" "}
                <span className="font-mono font-medium text-foreground">
                  {order.tracking_number}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 print:hidden"
                aria-label="Copy tracking number"
                onClick={() => {
                  navigator.clipboard?.writeText(order.tracking_number)
                  toast({ title: "Tracking number copied" })
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The receipt. Kept as one block so print CSS has a single thing to keep. */}
      <Card>
        <CardContent className="space-y-4 p-5">
          {/* Print-only letterhead: a receipt has to say who issued it. */}
          <div className="hidden print:block">
            <p className="font-display text-lg font-bold">{LEGAL.brand}</p>
            <p className="text-xs text-muted-foreground">
              {LEGAL.legalName} · {LEGAL.supportEmail}
            </p>
            <Separator className="my-3" />
          </div>

          <h3 className="font-semibold">Items</h3>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {formatQuantity(item.quantity, item.unit_type)} @ {formatNaira(item.price)}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">
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
                <p className="mb-1 text-sm font-medium">Delivery address</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {order.shipping_address}
                </p>
              </div>
            </>
          )}

          {order.notes && (
            <>
              <Separator />
              <div>
                <p className="mb-1 text-sm font-medium">Your notes</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {order.notes}
                </p>
              </div>
            </>
          )}

          {order.payment_reference && (
            <p className="pt-1 text-xs text-muted-foreground">
              Payment reference: <span className="font-mono">{order.payment_reference}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="print:hidden">
        <RefundRequest order={order} />
      </div>

      {order.status === "pending" && (
        <div className="print:hidden">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Cancel this order
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                <AlertDialogDescription>
                  It hasn&apos;t been paid for, so nothing will be charged. This
                  can&apos;t be undone — you&apos;d need to place a new order.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep order</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    cancel.mutate(order.id, {
                      onSuccess: () => toast({ title: "Order canceled" }),
                      onError: (err) =>
                        toast({
                          title: "Couldn't cancel",
                          description: err.message,
                          variant: "destructive",
                        }),
                    })
                  }
                >
                  Cancel order
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
