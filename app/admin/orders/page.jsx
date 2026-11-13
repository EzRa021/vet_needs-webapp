"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUp,
  BellRing,
  Columns3,
  Download,
  RefreshCw,
  Search,
  ShoppingBag,
  TriangleAlert,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import LiveIndicator from "@/components/admin/orders/live-indicator"
import AlertSettings, { useNotificationPermission } from "@/components/admin/orders/alert-settings"
import OrderPipeline from "@/components/admin/orders/order-pipeline"
import OrdersTable, { MOVE_LABEL } from "@/components/admin/orders/orders-table"
import { useToast } from "@/hooks/use-toast"
import { useNow } from "@/hooks/use-now"
import {
  fetchAllAdminOrders,
  useAdminOrderSummary,
  useAdminOrders,
  useBulkUpdateOrders,
  useUpdateOrder,
} from "@/stores/adminStore"
import { useOrderLiveStore } from "@/stores/orderLiveStore"
import { downloadCsv } from "@/lib/csv"
import { readStored, writeStored } from "@/lib/local-prefs"
import { formatNaira } from "@/lib/pricing"
import { canTransition, ORDER_STATUSES, orderRef, parseShippingAddress, statusMeta } from "@/lib/order-status"

const DEFAULTS = { status: "all", search: "", range: "all", sort: "newest", page: 1, limit: 20 }
const RANGES = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
]
const SORTS = ["newest", "oldest", "total_desc", "total_asc"]
const PAGE_SIZES = [20, 50, 100]
const BULK_MOVES = ["processing", "shipped", "delivered"]
const POLL_MS = 30 * 1000

const COLUMNS_KEY = "vn-admin-order-columns"
const BANNER_KEY = "vn-admin-order-alerts-banner"
const DEFAULT_COLUMNS = { items: true, delivery: true, payment: true }

// Filters live in the URL, so a filtered view survives a refresh, the back
// button, and being pasted to a colleague.
function readFilters(params) {
  const status = params.get("status")
  const range = params.get("range")
  const sort = params.get("sort")
  const limit = Number(params.get("limit"))
  return {
    status: ORDER_STATUSES.includes(status) ? status : "all",
    search: (params.get("search") || "").slice(0, 100),
    range: RANGES.some((r) => r.value === range) ? range : "all",
    sort: SORTS.includes(sort) ? sort : "newest",
    page: Math.max(Number(params.get("page")) || 1, 1),
    limit: PAGE_SIZES.includes(limit) ? limit : DEFAULTS.limit,
  }
}

const CSV_COLUMNS = [
  { key: "id", label: "Order", format: (v) => orderRef(v) },
  { key: "created_at", label: "Placed", format: (v) => new Date(v).toISOString() },
  { key: "status", label: "Status", format: (v) => statusMeta(v).label },
  { key: "customer", label: "Customer" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "lineCount", label: "Products" },
  { key: "items", label: "Items" },
  { key: "subtotal", label: "Subtotal (NGN)" },
  { key: "shipping_fee", label: "Delivery (NGN)" },
  { key: "tax_amount", label: "VAT (NGN)" },
  { key: "discount_amount", label: "Discount (NGN)" },
  { key: "coupon_code", label: "Coupon" },
  { key: "total_amount", label: "Total (NGN)" },
  { key: "paid_at", label: "Paid at", format: (v) => (v ? new Date(v).toISOString() : "") },
  { key: "payment_reference", label: "Payment reference" },
  { key: "tracking_number", label: "Tracking number" },
]

const toCsvRow = (o) => {
  const address = parseShippingAddress(o.shipping_address)
  const items = Array.isArray(o.order_items) ? o.order_items : []
  return {
    ...o,
    customer: o.customerName || address.name || "",
    email: o.email || address.email || "",
    phone: address.phone || o.customerPhone || "",
    city: address.city || "",
    state: address.state || "",
    items: items.map((i) => `${i.quantity}${i.unit_type === "kg" ? " kg" : " x"} ${i.name}`).join("; "),
  }
}

function TodayLine({ today, loading }) {
  if (loading || !today) return <Skeleton className="h-4 w-72" />
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold tabular-nums text-foreground">{today.orders}</span> order
        {today.orders === 1 ? "" : "s"} today
      </span>
      <Separator orientation="vertical" className="h-4" />
      <span>
        <span className="font-semibold tabular-nums text-foreground">{formatNaira(today.revenue)}</span> collected
      </span>
      {today.paidOrders > 0 && (
        <>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <span className="hidden sm:inline">
            average <span className="font-medium tabular-nums text-foreground">{formatNaira(today.averageOrder)}</span>
          </span>
        </>
      )}
    </div>
  )
}

function AdminOrdersPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const now = useNow(15 * 1000)

  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const [searchInput, setSearchInput] = useState(filters.search)
  const [selected, setSelected] = useState(() => new Set())
  const [busyIds, setBusyIds] = useState(() => new Set())
  const [exporting, setExporting] = useState(false)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [bannerDismissed, setBannerDismissed] = useState(true)
  const [seenArrivalsAt, setSeenArrivalsAt] = useState(() => Date.now())
  const searchRef = useRef(null)
  // Latest filters for callbacks that fire later (the search debounce), so a
  // status clicked mid-debounce isn't overwritten by a stale copy.
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  // The last search this box pushed to the URL, so the URL echoing it back
  // doesn't reset the box while someone is still typing.
  const pushedSearch = useRef(filters.search)

  const connection = useOrderLiveStore((s) => s.connection)
  const fresh = useOrderLiveStore((s) => s.fresh)
  const arrivals = useOrderLiveStore((s) => s.arrivals)
  const prefs = useOrderLiveStore((s) => s.prefs)
  const prefsLoaded = useOrderLiveStore((s) => s.prefsLoaded)
  const { permission, request } = useNotificationPermission()

  // While the live connection is up, changes arrive by push. If it isn't
  // (network blip, or migration 024 not run yet), fall back to polling.
  const pollMs = connection === "live" ? false : POLL_MS
  const { data, isLoading, isError, isFetching, refetch } = useAdminOrders(filters, { pollMs })
  const summaryFilters = useMemo(() => ({ search: filters.search, range: filters.range }), [filters.search, filters.range])
  const summary = useAdminOrderSummary(summaryFilters, { pollMs })

  const update = useUpdateOrder()
  const bulk = useBulkUpdateOrders()

  const orders = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, pages: 0, limit: filters.limit }
  const hasFilters = filters.search || filters.status !== "all" || filters.range !== "all"

  useEffect(() => {
    setColumns(readStored(COLUMNS_KEY, DEFAULT_COLUMNS))
    setBannerDismissed(readStored(BANNER_KEY, { dismissed: false }).dismissed)
  }, [])

  const setFilters = (patch) => {
    const next = { ...filtersRef.current, ...patch }
    // Any change other than paging starts again from page 1.
    if (!("page" in patch)) next.page = 1
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) {
      if (v !== DEFAULTS[k] && v !== "" && v != null) params.set(k, String(v))
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Search as you type, debounced so each keystroke isn't a request.
  useEffect(() => {
    const value = searchInput.trim()
    if (value === filtersRef.current.search) return
    const t = setTimeout(() => {
      pushedSearch.current = value
      setFilters({ search: value })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Keep the box in step when the URL changes underneath it (back button),
  // but not when the change is this box's own search coming back.
  useEffect(() => {
    if (filters.search === pushedSearch.current) return
    pushedSearch.current = filters.search
    setSearchInput(filters.search)
  }, [filters.search])

  // A selection only makes sense for the rows it was made on.
  useEffect(() => {
    setSelected(new Set())
  }, [filters.status, filters.search, filters.range, filters.sort, filters.page, filters.limit])

  // "/" jumps to search, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // New orders that arrived while this view couldn't show them (another page,
  // a filter, an odd sort). On page 1 of the newest-first list they simply
  // appear at the top, so there's nothing to announce.
  const showsNewest =
    filters.page === 1 && filters.sort === "newest" && !filters.search && ["all", "pending"].includes(filters.status)
  const missed = showsNewest ? [] : arrivals.filter((a) => a.at > seenArrivalsAt)

  const showNewest = () => {
    setSeenArrivalsAt(Date.now())
    setSearchInput("")
    setFilters({ ...DEFAULTS })
  }

  const setColumn = (key, on) => {
    const next = { ...columns, [key]: on }
    setColumns(next)
    writeStored(COLUMNS_KEY, next)
  }

  const dismissBanner = () => {
    setBannerDismissed(true)
    writeStored(BANNER_KEY, { dismissed: true })
  }

  const showAlertBanner =
    prefsLoaded && !bannerDismissed && prefs.desktop && permission === "default"

  const markBusy = (id, on) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      on ? next.add(id) : next.delete(id)
      return next
    })

  const moveOrder = async (order, status) => {
    markBusy(order.id, true)
    try {
      await update.mutateAsync({ id: order.id, status })
      toast({
        title: `${orderRef(order.id)} is now ${statusMeta(status).label.toLowerCase()}`,
        description:
          status === "shipped" || status === "delivered"
            ? "The customer has been emailed and sees the update live."
            : "The customer sees the update live.",
      })
    } catch (err) {
      toast({ title: `Couldn't update ${orderRef(order.id)}`, description: err.message, variant: "destructive" })
    } finally {
      markBusy(order.id, false)
    }
  }

  const selectedOrders = orders.filter((o) => selected.has(o.id))

  const bulkMove = async (status) => {
    const eligible = selectedOrders.filter((o) => canTransition(o.status, status))
    if (!eligible.length) return
    try {
      const { updated, failed } = await bulk.mutateAsync({ ids: eligible.map((o) => o.id), status })
      const skipped = selectedOrders.length - eligible.length
      toast({
        title: `${updated.length} order${updated.length === 1 ? "" : "s"} marked ${statusMeta(status).label.toLowerCase()}`,
        description:
          [
            failed.length ? `${failed.length} failed: ${failed[0].error}` : null,
            skipped ? `${skipped} skipped because they can't move to ${statusMeta(status).label.toLowerCase()} from their current status.` : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        variant: failed.length && !updated.length ? "destructive" : undefined,
      })
      setSelected(new Set())
    } catch (err) {
      toast({ title: "Bulk update failed", description: err.message, variant: "destructive" })
    }
  }

  const exportCsv = async (rows) => {
    setExporting(true)
    try {
      const data = rows || (await fetchAllAdminOrders({ ...filters, page: undefined, limit: undefined }))
      const stamp = new Date().toISOString().slice(0, 10)
      downloadCsv(`orders-${stamp}.csv`, data.map(toCsvRow), CSV_COLUMNS)
      toast({ title: `Exported ${data.length} order${data.length === 1 ? "" : "s"}` })
    } catch (err) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const copyRef = (order) => {
    navigator.clipboard?.writeText(orderRef(order.id))
    toast({ title: `Copied ${orderRef(order.id)}` })
  }

  const reset = () => {
    setSearchInput("")
    setFilters({ status: "all", search: "", range: "all" })
  }

  const from = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const to = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-bold">Orders</h1>
            <LiveIndicator now={now} />
          </div>
          <TodayLine today={summary.data?.today} loading={summary.isLoading} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refetch()
              summary.refetch()
            }}
            disabled={isFetching}
            aria-label="Refresh orders"
          >
            <RefreshCw data-icon="inline-start" className={isFetching ? "motion-safe:animate-spin" : undefined} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv()} disabled={exporting || !pagination.total}>
            {exporting ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
            Export CSV
          </Button>
          <AlertSettings />
        </div>
      </div>

      {showAlertBanner && (
        <Alert className="border-primary/30 bg-primary/5">
          <BellRing className="text-primary" />
          <AlertTitle>Hear new orders even when this tab is in the background</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Turn on desktop notifications and you&apos;ll get a chime and a pop-up for every new order and payment.</span>
            <span className="flex shrink-0 gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  const result = await request()
                  if (result !== "default") dismissBanner()
                }}
              >
                Turn on notifications
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissBanner}>
                Not now
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <OrderPipeline
        counts={summary.data?.counts}
        stale={summary.data?.stale}
        active={filters.status}
        onSelect={(status) => setFilters({ status })}
        loading={summary.isLoading}
      />

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Orders didn&apos;t load</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            Check your connection and try again. If it keeps failing, confirm migration 003 has been run.
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {/* Toolbar, or the bulk bar while rows are selected */}
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/60 p-3" role="toolbar" aria-label="Bulk actions">
              <span className="mr-1 text-sm font-medium tabular-nums">{selected.size} selected</span>
              {BULK_MOVES.map((status) => {
                const count = selectedOrders.filter((o) => canTransition(o.status, status)).length
                return (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "processing" ? "default" : "outline"}
                    disabled={!count || bulk.isPending}
                    onClick={() => bulkMove(status)}
                  >
                    {bulk.isPending && bulk.variables?.status === status && <Spinner data-icon="inline-start" />}
                    {MOVE_LABEL[status]}
                    <span className="tabular-nums opacity-70">({count})</span>
                  </Button>
                )
              })}
              <Button size="sm" variant="outline" onClick={() => exportCsv(selectedOrders)} disabled={exporting}>
                <Download data-icon="inline-start" />
                Export selected
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
                <X data-icon="inline-start" />
                Clear selection
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchInput("")}
                  placeholder="Search name, phone, email, #order, tracking or reference"
                  className="pl-9 pr-10"
                  aria-label="Search orders"
                />
                <Kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
              </div>

              <Select value={filters.range} onValueChange={(range) => setFilters({ range })}>
                <SelectTrigger className="w-[150px]" aria-label="Date range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {RANGES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10">
                    <Columns3 data-icon="inline-start" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={columns.items} onCheckedChange={(v) => setColumn("items", v)}>
                    Items
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={columns.delivery} onCheckedChange={(v) => setColumn("delivery", v)}>
                    Delivery
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={columns.payment} onCheckedChange={(v) => setColumn("payment", v)}>
                    Payment
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-10" onClick={reset}>
                  <X data-icon="inline-start" />
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {missed.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/5 px-3 py-2" role="status">
              <span className="text-sm font-medium">
                {missed.length} new order{missed.length === 1 ? "" : "s"} arrived since you opened this view
              </span>
              <span className="flex gap-1">
                <Button size="sm" onClick={showNewest}>
                  <ArrowUp data-icon="inline-start" />
                  Show newest
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSeenArrivalsAt(Date.now())}>
                  Dismiss
                </Button>
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBag />
                </EmptyMedia>
                <EmptyTitle>{hasFilters ? "No orders match these filters" : "No orders yet"}</EmptyTitle>
                <EmptyDescription>
                  {hasFilters
                    ? "Try a different search, status or date range."
                    : "New orders appear here the moment a customer checks out. Keep this page open and you'll hear them arrive."}
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
              <OrdersTable
                orders={orders}
                now={now}
                fresh={fresh}
                sort={filters.sort}
                onSort={(sort) => setFilters({ sort })}
                columns={columns}
                selected={selected}
                onSelectedChange={setSelected}
                onMove={moveOrder}
                onCopy={copyRef}
                busyIds={busyIds}
              />
            </div>
          )}

          {/* Footer: range, page size, paging */}
          {pagination.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
              <span className="text-sm tabular-nums text-muted-foreground">
                Showing {from}–{to} of {pagination.total.toLocaleString("en-NG")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(filters.limit)} onValueChange={(v) => setFilters({ limit: Number(v) })}>
                  <SelectTrigger className="h-9 w-[124px]" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PAGE_SIZES.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} per page
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters({ page: pagination.page - 1 })}
                >
                  Previous
                </Button>
                <span className="px-1 text-sm tabular-nums text-muted-foreground">
                  {pagination.page} / {Math.max(pagination.pages, 1)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setFilters({ page: pagination.page + 1 })}
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

// useSearchParams needs a Suspense boundary to build in Next.js.
export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AdminOrdersPageContent />
    </Suspense>
  )
}
