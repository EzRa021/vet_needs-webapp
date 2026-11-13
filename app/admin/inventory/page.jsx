"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Boxes, ClipboardList, Download, PackagePlus, RefreshCw, Search, TriangleAlert, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import BrandImage from "@/components/brand-image"
import StockAdjust from "@/components/admin/stock-adjust"
import { StockLevel } from "@/components/admin/stock-level"
import LiveIndicator from "@/components/admin/orders/live-indicator"
import AlertSettings from "@/components/admin/orders/alert-settings"
import StockHealth from "@/components/admin/inventory/stock-health"
import Valuation from "@/components/admin/inventory/valuation"
import StockActivity from "@/components/admin/inventory/stock-activity"
import { useNow } from "@/hooks/use-now"
import { useInventory, useInventoryMovements } from "@/stores/adminStore"
import { useStockLiveStore } from "@/stores/stockLiveStore"
import { cn } from "@/lib/utils"
import { formatNaira } from "@/lib/pricing"
import { formatQuantity } from "@/lib/units"
import { downloadCsv } from "@/lib/csv"

const POLL_MS = 30 * 1000
const PAGE = 50
const FLASH_FOR_MS = 6 * 1000
const CHANGE_CHIP_MS = 60 * 1000

const STATUS_LABEL = { out: "Out of stock", low: "Low", ok: "Healthy", untracked: "Not tracked" }
const RANK = { out: 0, low: 1, ok: 2, untracked: 3 }

const SORTS = [
  { value: "attention", label: "Needs attention first" },
  { value: "cover", label: "Fewest days left" },
  { value: "sales", label: "Best sellers (30 days)" },
  { value: "value", label: "Highest stock value" },
  { value: "name", label: "Name, A to Z" },
]

// How much to order to get back to a comfortable level: enough for the last
// 30 days' sales, and never less than twice the reorder point.
const suggestedOrder = (r) => {
  if (r.stock === null) return 0
  const target = Math.max(Math.ceil(r.sold_30d || 0), r.threshold * 2)
  return Math.max(Math.ceil(target - Math.max(r.stock, 0)), 0)
}

const compare = {
  attention: (a, b) =>
    RANK[a.status] - RANK[b.status] ||
    (a.days_of_cover ?? Infinity) - (b.days_of_cover ?? Infinity) ||
    (a.stock ?? 0) - (b.stock ?? 0),
  cover: (a, b) => (a.days_of_cover ?? Infinity) - (b.days_of_cover ?? Infinity) || RANK[a.status] - RANK[b.status],
  sales: (a, b) => b.sold_30d - a.sold_30d,
  value: (a, b) => b.stock_cost - a.stock_cost,
  name: (a, b) => a.name.localeCompare(b.name),
}

function CoverCell({ row }) {
  if (row.status === "out") return <span className="text-sm font-medium text-destructive">None left</span>
  if (row.days_of_cover === null) {
    return <span className="text-xs text-muted-foreground">{row.sold_30d > 0 ? "—" : "No recent sales"}</span>
  }
  const urgent = row.days_of_cover < 7
  return (
    <span className={cn("text-sm tabular-nums", urgent ? "font-semibold text-destructive" : "text-foreground")}>
      {row.days_of_cover === 0 ? "Under a day" : `About ${row.days_of_cover} day${row.days_of_cover === 1 ? "" : "s"}`}
    </span>
  )
}

export default function AdminInventoryPage() {
  const now = useNow(15 * 1000)
  const connection = useStockLiveStore((s) => s.connection)
  const fresh = useStockLiveStore((s) => s.fresh)
  const pollMs = connection === "live" ? false : POLL_MS

  const { data, isLoading, isError, isFetching, refetch } = useInventory({ pollMs })
  const movements = useInventoryMovements({ limit: 30, pollMs })

  const [status, setStatus] = useState("all")
  const [category, setCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("attention")
  const [shown, setShown] = useState(PAGE)

  const rows = data?.rows || []
  const t = data?.totals

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => category === "all" || (category === "none" ? !r.category : r.category === category))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.sku || "").toLowerCase().includes(q))
      .sort(compare[sort])
  }, [rows, status, category, search, sort])

  const reorder = useMemo(
    () => rows.filter((r) => r.status === "out" || r.status === "low").sort(compare.attention),
    [rows]
  )
  const hasFilters = status !== "all" || category !== "all" || search

  const stamp = () => new Date().toISOString().slice(0, 10)

  // The sheet you take to the supplier.
  const exportReorder = () =>
    downloadCsv(`vetneeds-reorder-${stamp()}.csv`, reorder, [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "category", label: "Category" },
      { key: "stock", label: "In stock", format: (v, r) => formatQuantity(Math.max(v ?? 0, 0), r.unit_type) },
      { key: "threshold", label: "Reorder at", format: (v, r) => formatQuantity(v, r.unit_type) },
      { key: "sold_30d", label: "Sold in last 30 days", format: (v, r) => formatQuantity(v, r.unit_type) },
      { key: "days_of_cover", label: "Days left at current sales", format: (v) => (v === null ? "" : v) },
      { key: "suggested", label: "Suggested order", format: (_, r) => formatQuantity(suggestedOrder(r), r.unit_type) },
      { key: "cost", label: "Unit cost (NGN)", format: (v) => (v === null ? "" : v) },
      { key: "status", label: "Status", format: (v) => STATUS_LABEL[v] || v },
    ])

  const exportValuation = () =>
    downloadCsv(`vetneeds-stock-valuation-${stamp()}.csv`, visible, [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "category", label: "Category" },
      { key: "stock", label: "In stock", format: (v, r) => formatQuantity(Math.max(v ?? 0, 0), r.unit_type) },
      { key: "cost", label: "Unit cost (NGN)", format: (v) => (v === null ? "" : v) },
      { key: "price", label: "Price (NGN)" },
      { key: "net_price", label: "Price without VAT (NGN)" },
      { key: "stock_cost", label: "Stock value at cost (NGN)" },
      { key: "stock_retail", label: "Stock value at price (NGN)" },
      { key: "margin_percent", label: "Margin %", format: (v) => (v === null ? "" : v) },
      { key: "sold_30d", label: "Sold in last 30 days" },
      { key: "status", label: "Status", format: (v) => STATUS_LABEL[v] || v },
    ])

  const reset = () => {
    setStatus("all")
    setCategory("all")
    setSearch("")
    setShown(PAGE)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-bold">Inventory</h1>
            <LiveIndicator now={now} source="stock" />
          </div>
          <p className="text-sm text-muted-foreground">
            What your stock is worth, how long it will last, and what to reorder. Cost figures are staff-only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refetch()
              movements.refetch()
            }}
            disabled={isFetching}
            aria-label="Refresh inventory"
          >
            <RefreshCw data-icon="inline-start" className={isFetching ? "motion-safe:animate-spin" : undefined} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <AlertSettings />
          <Button variant="outline" size="sm" disabled={!visible.length} onClick={exportValuation}>
            <Download data-icon="inline-start" />
            Valuation CSV
          </Button>
          <Button size="sm" disabled={reorder.length === 0} onClick={exportReorder}>
            <ClipboardList data-icon="inline-start" />
            Reorder list ({reorder.length})
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Inventory didn&apos;t load</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            Check your connection and try again. If it keeps failing, confirm migration 023 has run.
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading || !t ? (
        !isError && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        )
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Valuation totals={t} />
            <StockHealth
              totals={t}
              active={status}
              onSelect={(s) => {
                setStatus(s)
                setShown(PAGE)
              }}
            />
          </div>

          {/* The valuation is only as honest as the cost data. Say when it
              isn't: an unqualified "stock value" that quietly leaves out half
              the catalogue is the VAT-report mistake all over again. */}
          {t.missing_cost > 0 && (
            <Alert>
              <TriangleAlert className="size-4" />
              <AlertTitle>Stock value is understated</AlertTitle>
              <AlertDescription>
                {t.missing_cost} in-stock {t.missing_cost === 1 ? "product has" : "products have"} no cost price,
                so {t.missing_cost === 1 ? "it counts" : "they count"} as ₦0 above and{" "}
                {t.missing_cost === 1 ? "is" : "are"} left out of the margin. Add cost prices for an accurate figure.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="gap-0 overflow-hidden py-0">
              <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setShown(PAGE)
                    }}
                    onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                    placeholder="Search product or SKU"
                    className="pl-9"
                    aria-label="Search inventory"
                  />
                </div>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v)
                    setShown(PAGE)
                  }}
                >
                  <SelectTrigger className="w-[170px]" aria-label="Category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="none">Uncategorised</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="w-[200px]" aria-label="Sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SORTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-10" onClick={reset}>
                    <X data-icon="inline-start" />
                    Clear filters
                  </Button>
                )}
              </div>

              {visible.length === 0 ? (
                <Empty className="py-14">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Boxes />
                    </EmptyMedia>
                    <EmptyTitle>
                      {rows.length === 0
                        ? "No products yet"
                        : status === "out" || status === "low"
                          ? "Nothing to restock here"
                          : "No products match these filters"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {rows.length === 0
                        ? "Add products and their stock to see what your inventory is worth."
                        : "Try a different search, category or stock status."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {hasFilters && rows.length > 0 && (
                    <EmptyContent>
                      <Button variant="outline" onClick={reset}>
                        Clear filters
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[860px]">
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-4">Product</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead className="text-right">Sold, 30 days</TableHead>
                          <TableHead>Lasts</TableHead>
                          <TableHead className="text-right">Unit cost</TableHead>
                          <TableHead className="text-right">Stock value</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="w-[120px] pr-4">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visible.slice(0, shown).map((r) => {
                          const live = fresh[r.id]
                          const flashing = live && now - live.at < FLASH_FOR_MS
                          const change = live?.change && now - live.at < CHANGE_CHIP_MS ? live.change : null
                          const suggest = r.status === "out" || r.status === "low" ? suggestedOrder(r) : 0
                          return (
                            <TableRow
                              key={`${r.id}-${live?.at || 0}`}
                              className={cn("align-top [&>td]:py-3", flashing && "motion-safe:animate-row-flash")}
                            >
                              <TableCell className={cn("max-w-[280px] pl-4", flashing && "shadow-[inset_3px_0_0_hsl(var(--primary))]")}>
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "relative size-10 shrink-0 overflow-hidden rounded-lg border bg-surface-2",
                                      !r.is_active && "opacity-50 grayscale"
                                    )}
                                  >
                                    <BrandImage src={r.image_url} alt="" fill sizes="40px" className="object-cover" />
                                  </div>
                                  <div className="flex min-w-0 flex-col gap-0.5">
                                    <Link
                                      href={`/admin/products/${r.id}`}
                                      className="truncate font-medium hover:text-primary hover:underline"
                                    >
                                      {r.name}
                                    </Link>
                                    <span className="truncate text-xs text-muted-foreground">
                                      {[r.sku, r.category, !r.is_active && "hidden from shop"].filter(Boolean).join(", ") ||
                                        "No SKU"}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {r.stock === null ? (
                                  <span className="text-sm text-muted-foreground">Not tracked</span>
                                ) : (
                                  <StockLevel
                                    stock={r.stock}
                                    threshold={r.threshold}
                                    unitType={r.unit_type}
                                    allowBackorder={r.allow_backorder}
                                    change={change}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {r.sold_30d > 0 ? formatQuantity(r.sold_30d, r.unit_type) : <span className="text-muted-foreground">0</span>}
                              </TableCell>
                              <TableCell>
                                <CoverCell row={r} />
                                {suggest > 0 && (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    Order about {formatQuantity(suggest, r.unit_type)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                {r.cost === null ? "Not set" : formatNaira(r.cost)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {r.cost === null ? <span className="text-muted-foreground">—</span> : formatNaira(r.stock_cost)}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {r.margin_percent === null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <span className={cn(r.margin_percent < 0 && "font-medium text-destructive")}>
                                    {r.margin_percent.toFixed(0)}%
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="pr-4">
                                <StockAdjust
                                  product={r}
                                  trigger={
                                    <Button size="sm" variant={r.status === "out" || r.status === "low" ? "default" : "outline"}>
                                      <PackagePlus data-icon="inline-start" />
                                      Adjust
                                    </Button>
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Showing {Math.min(shown, visible.length)} of {visible.length}
                      {t.velocity_days ? `. Sales and days left are from the last ${t.velocity_days} days of shop orders.` : ""}
                    </span>
                    {shown < visible.length && (
                      <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                        Show {Math.min(PAGE, visible.length - shown)} more
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>

            <div className="xl:sticky xl:top-20">
              <StockActivity entries={movements.data} loading={movements.isLoading} now={now} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
