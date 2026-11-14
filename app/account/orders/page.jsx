"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Loader2, ShoppingBag, AlertCircle, Truck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrderProgressTicks, OrderStatusBadge } from "@/components/order-status-badge"
import { CustomerLiveChip, useCustomerOrderLive } from "@/components/customer-order-realtime"
import { useUser } from "@/stores/authStore"
import { useNow } from "@/hooks/use-now"
import { createClient } from "@/lib/supabase/client"
import { formatNaira } from "@/lib/pricing"
import { orderRef } from "@/lib/order-status"
import { timeAgo, fullDateTime } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

const FLASH_FOR_MS = 6 * 1000

const useMyOrders = (enabled) =>
  useQuery({
    queryKey: ["my-orders"],
    enabled,
    queryFn: async () => {
      const supabase = createClient()
      // RLS guarantees users only ever see their own orders.
      // Only what the list renders — the detail page fetches the rest itself.
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, updated_at, paid_at, status, total_amount, order_items, tracking_number, fulfilment_method")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

function itemSummary(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : []
  if (!items.length) return "No items"
  return items.length === 1 ? items[0].name : `${items[0].name} and ${items.length - 1} more`
}

export default function MyOrdersPage() {
  const router = useRouter()
  const now = useNow(30 * 1000)
  const { data: user, isLoading: userLoading } = useUser()
  const { data: orders, isLoading, isError, refetch } = useMyOrders(!!user)
  const changed = useCustomerOrderLive((s) => s.changed)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login?redirect=/account/orders")
    }
  }, [user, userLoading, router])

  if (userLoading || !user) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const flashing = (id) => changed[id] && Date.now() - changed[id] < FLASH_FOR_MS
  const open = (id) => router.push(`/account/orders/${id}`)

  // The heading, container and nav live in app/account/layout.jsx.
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {orders?.length
            ? `${orders.length} order${orders.length === 1 ? "" : "s"}, newest first`
            : "Your orders"}
        </p>
        <CustomerLiveChip />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Alert variant="destructive" className="mx-auto max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Your orders didn&apos;t load</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            Check your connection and try again.
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !orders || orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            When you place your first order, it shows up here and you can follow it
            live from payment to your door.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/shop">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Phones: one card per order — a five-column table doesn't fit. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <li key={`${order.id}-${changed[order.id] || 0}`}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
                    flashing(order.id) && "motion-safe:animate-row-flash"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold tabular-nums">{orderRef(order.id)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatNaira(order.total_amount)}</p>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{itemSummary(order)}</p>
                  <div className="flex items-center justify-between gap-3">
                    <OrderStatusBadge status={order.status} method={order.fulfilment_method} />
                    <OrderProgressTicks status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[150px]">Order</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[52px]">
                    <span className="sr-only">View</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  // A row links to /account/orders/[id] rather than opening a
                  // dialog: an order is something people bookmark, share with
                  // support and print, none of which a dialog can do.
                  <TableRow
                    key={`${order.id}-${changed[order.id] || 0}`}
                    className={cn("cursor-pointer align-top", flashing(order.id) && "motion-safe:animate-row-flash")}
                    onClick={() => open(order.id)}
                  >
                    <TableCell>
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="font-semibold tabular-nums hover:text-primary"
                        // The row handles the click; this keeps it a real
                        // link for keyboard users and "open in new tab".
                        onClick={(e) => e.stopPropagation()}
                      >
                        {orderRef(order.id)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="truncate text-sm">{itemSummary(order)}</p>
                      {order.tracking_number && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck className="size-3" aria-hidden="true" />
                          {order.tracking_number}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <OrderStatusBadge status={order.status} method={order.fulfilment_method} />
                        <OrderProgressTicks status={order.status} />
                        {order.updated_at && (
                          <span className="text-xs text-muted-foreground" title={fullDateTime(order.updated_at)}>
                            Updated {timeAgo(order.updated_at, now)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatNaira(order.total_amount)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
