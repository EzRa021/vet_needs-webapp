"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Package, ChevronRight, Loader2, ShoppingBag, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { useUser } from "@/stores/authStore"
import { createClient } from "@/lib/supabase/client"
import { formatNaira } from "@/lib/pricing"
import { statusMeta } from "@/lib/order-status"

function StatusBadge({ status }) {
  const { label, variant } = statusMeta(status)
  return <Badge variant={variant}>{label}</Badge>
}

const useMyOrders = (enabled) =>
  useQuery({
    queryKey: ["my-orders"],
    enabled,
    queryFn: async () => {
      const supabase = createClient()
      // RLS guarantees users only ever see their own orders.
      // Only what the table renders — the detail page fetches the rest itself.
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, total_amount, order_items")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })


export default function MyOrdersPage() {
  const router = useRouter()
  const { data: user, isLoading: userLoading } = useUser()
  const { data: orders, isLoading, isError } = useMyOrders(!!user)

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

  // The heading, container and nav live in app/account/layout.jsx.
  return (
    <div>
      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Alert variant="destructive" className="mx-auto max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load your orders</AlertTitle>
          <AlertDescription>
            Please refresh the page or try again in a moment.
          </AlertDescription>
        </Alert>
      ) : !orders || orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-20 text-center">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            When you place your first order, it will show up here with its status
            and delivery details.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/shop">Start Shopping</Link>
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[140px]">Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[60px]"><span className="sr-only">View</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const items = Array.isArray(order.order_items) ? order.order_items : []
                  const itemCount = items.reduce((n, i) => n + Number(i.quantity || 0), 0)
                  return (
                    // A row links to /account/orders/[id] rather than opening a
                    // dialog: an order is something people bookmark, share with
                    // support and print, none of which a dialog can do.
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/account/orders/${order.id}`)}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/account/orders/${order.id}`}
                          className="flex items-center gap-2 hover:text-primary"
                          // The row handles the click; this keeps it a real
                          // link for keyboard users and "open in new tab".
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Package className="h-4 w-4 text-muted-foreground" />
                          #{order.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatNaira(order.total_amount)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
