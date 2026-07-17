"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, ShoppingBag, TriangleAlert, X, ChevronRight, Truck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAdminOrders } from "@/stores/adminStore"
import { ORDER_STATUS, statusMeta } from "@/lib/order-status"
import { formatNaira } from "@/lib/pricing"

// Pull the customer's name out of the stored address blob when the account
// has no profile name (guest-style checkouts still fill the address).
function addressName(address) {
  if (!address) return null
  const first = String(address).split("\n")[0]?.trim()
  return first || null
}

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState({ search: "", status: "all", page: 1, limit: 20 })
  const [searchInput, setSearchInput] = useState("")
  const { data, isLoading, isError } = useAdminOrders(filters)

  const orders = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, pages: 0 }
  const hasFilters = filters.search || filters.status !== "all"

  const reset = () => {
    setSearchInput("")
    setFilters({ search: "", status: "all", page: 1, limit: 20 })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} order{pagination.total === 1 ? "" : "s"}
            {hasFilters ? " matching your filters" : " in total"}
          </p>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load orders</AlertTitle>
          <AlertDescription>Refresh the page, or check that migration 003 has been run.</AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <form
              className="relative min-w-[200px] flex-1"
              onSubmit={(e) => {
                e.preventDefault()
                setFilters((f) => ({ ...f, search: searchInput, page: 1 }))
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search customer, email, tracking or payment ref…"
                className="pl-9"
                aria-label="Search orders"
              />
            </form>

            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v, page: 1 }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(ORDER_STATUS).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X data-icon="inline-start" />
                Clear
              </Button>
            )}
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingBag />
                  </EmptyMedia>
                  <EmptyTitle>
                    {hasFilters ? "No orders match those filters" : "No orders yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? "Try a different search or clear the filters."
                      : "Orders appear here as soon as customers check out."}
                  </EmptyDescription>
                </EmptyHeader>
                {hasFilters && (
                  <EmptyContent>
                    <Button variant="outline" onClick={reset}>
                      Clear filters
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="hidden sm:table-cell">Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => {
                      const meta = statusMeta(o.status)
                      return (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="font-medium tabular-nums hover:text-primary hover:underline"
                            >
                              #{o.id.slice(0, 8).toUpperCase()}
                            </Link>
                            {o.tracking_number && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Truck className="size-3" />
                                {o.tracking_number}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <span className="block truncate">
                              {o.customerName || addressName(o.shipping_address) || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                            {o.itemCount}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNaira(o.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="size-8" asChild>
                              <Link href={`/admin/orders/${o.id}`}>
                                <ChevronRight />
                                <span className="sr-only">Open order</span>
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t p-3">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
