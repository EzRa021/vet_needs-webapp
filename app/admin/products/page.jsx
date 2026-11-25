"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Columns3, Download, Package, Plus, RefreshCw, Search, TriangleAlert, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import BulkActions from "@/components/admin/bulk-actions"
import LiveIndicator from "@/components/admin/orders/live-indicator"
import AlertSettings from "@/components/admin/orders/alert-settings"
import CatalogHealth from "@/components/admin/products/catalog-health"
import ProductsTable, { vatText } from "@/components/admin/products/products-table"
import { useToast } from "@/hooks/use-toast"
import { useNow } from "@/hooks/use-now"
import {
  fetchAllAdminProducts,
  useAdminProductSummary,
  useAdminProducts,
  useAdminTaxonomy,
  useDeleteProduct,
  useSaveProduct,
} from "@/stores/adminStore"
import { useStockLiveStore } from "@/stores/stockLiveStore"
import { downloadCsv } from "@/lib/csv"
import { readStored, writeStored } from "@/lib/local-prefs"
import { margin, netPrice, stockLevel, STOCK_LEVEL_LABEL } from "@/lib/stock-movements"

const DEFAULTS = { status: "all", search: "", category: "all", sort: "newest", page: 1, limit: 20 }
const STATUSES = ["all", "active", "inactive", "featured", "low_stock", "out_of_stock"]
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
  { value: "name_asc", label: "Name, A to Z" },
  { value: "name_desc", label: "Name, Z to A" },
  { value: "price_desc", label: "Price, high to low" },
  { value: "price_asc", label: "Price, low to high" },
  { value: "stock_asc", label: "Stock, lowest first" },
  { value: "stock_desc", label: "Stock, highest first" },
]
const PAGE_SIZES = [20, 50, 100]
const POLL_MS = 30 * 1000
const COLUMNS_KEY = "vn-admin-product-columns"
const DEFAULT_COLUMNS = { category: true, margin: true, updated: true }

function flatten(nodes, out = [], depth = 0) {
  for (const n of nodes || []) {
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) flatten(n.children, out, depth + 1)
  }
  return out
}

// Filters live in the URL: a filtered view survives refresh and the back
// button, and "everything low in Poultry" is a link you can send.
function readFilters(params) {
  const status = params.get("status")
  const sort = params.get("sort")
  const limit = Number(params.get("limit"))
  return {
    status: STATUSES.includes(status) ? status : "all",
    search: (params.get("search") || "").slice(0, 100),
    category: params.get("category") || "all",
    sort: SORTS.some((s) => s.value === sort) ? sort : "newest",
    page: Math.max(Number(params.get("page")) || 1, 1),
    limit: PAGE_SIZES.includes(limit) ? limit : DEFAULTS.limit,
  }
}

const CSV_COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category", format: (c) => c?.name || "" },
  { key: "price", label: "Price (NGN)" },
  { key: "compare_at_price", label: "Compare at (NGN)" },
  { key: "cost_price", label: "Cost (NGN)" },
  { key: "net", label: "Price without VAT (NGN)", format: (_, r) => netPrice(r).toFixed(2) },
  { key: "margin", label: "Margin %", format: (_, r) => (margin(r) ? margin(r).percent.toFixed(1) : "") },
  { key: "stock", label: "Stock" },
  { key: "unit_type", label: "Unit" },
  { key: "low_stock_threshold", label: "Reorder at" },
  { key: "level", label: "Stock status", format: (_, r) => STOCK_LEVEL_LABEL[stockLevel(r)] },
  { key: "vat", label: "VAT", format: (_, r) => vatText(r) },
  { key: "is_active", label: "In shop", format: (v) => (v ? "On sale" : "Hidden") },
  { key: "is_featured", label: "Featured", format: (v) => (v ? "Yes" : "") },
]

function AdminProductsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const now = useNow(15 * 1000)

  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const pushedSearch = useRef(filters.search)
  const searchRef = useRef(null)

  const [searchInput, setSearchInput] = useState(filters.search)
  const [selected, setSelected] = useState(() => new Set())
  const [busyIds, setBusyIds] = useState(() => new Set())
  const [pendingDelete, setPendingDelete] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  const connection = useStockLiveStore((s) => s.connection)
  const fresh = useStockLiveStore((s) => s.fresh)
  const pollMs = connection === "live" ? false : POLL_MS

  const listFilters = useMemo(
    () => ({ ...filters }),
    [filters]
  )
  const summaryFilters = useMemo(
    () => ({ search: filters.search, category: filters.category }),
    [filters.search, filters.category]
  )
  const { data, isLoading, isError, isFetching, refetch } = useAdminProducts(listFilters, { pollMs })
  const summary = useAdminProductSummary(summaryFilters, { pollMs })
  const { data: tree } = useAdminTaxonomy()
  const save = useSaveProduct()
  const del = useDeleteProduct()

  const items = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, pages: 0, limit: filters.limit }
  const categories = useMemo(() => flatten(tree), [tree])
  const hasFilters = filters.search || filters.category !== "all" || filters.status !== "all"

  useEffect(() => {
    setColumns(readStored(COLUMNS_KEY, DEFAULT_COLUMNS))
  }, [])

  const setFilters = (patch) => {
    const next = { ...filtersRef.current, ...patch }
    if (!("page" in patch)) next.page = 1
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) {
      if (v !== DEFAULTS[k] && v !== "" && v != null) params.set(k, String(v))
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Search as you type, debounced.
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

  // Follow the URL when it changes underneath the box (back button), but not
  // when it's this box's own search coming back.
  useEffect(() => {
    if (filters.search === pushedSearch.current) return
    pushedSearch.current = filters.search
    setSearchInput(filters.search)
  }, [filters.search])

  // Selection is scoped to the rows on screen and dropped whenever they change:
  // carrying it across a filter means acting on products nobody can see.
  useEffect(() => {
    setSelected(new Set())
  }, [filters.status, filters.search, filters.category, filters.sort, filters.page, filters.limit])

  // "/" jumps to search.
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

  const markBusy = (id, on) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      on ? next.add(id) : next.delete(id)
      return next
    })

  const patchProduct = async (item, patch, success) => {
    markBusy(item.id, true)
    try {
      await save.mutateAsync({ id: item.id, ...patch })
      toast(success)
    } catch (err) {
      toast({ title: `Couldn't update ${item.name}`, description: err.message, variant: "destructive" })
    } finally {
      markBusy(item.id, false)
    }
  }

  const toggleActive = (item) =>
    patchProduct(item, { is_active: !item.is_active }, {
      title: item.is_active ? "Hidden from the shop" : "On sale",
      description: item.is_active
        ? `${item.name} no longer shows to shoppers.`
        : `${item.name} is now visible in the shop.`,
    })

  const toggleFeatured = (item) =>
    patchProduct(item, { is_featured: !item.is_featured }, {
      title: item.is_featured ? "Removed from featured" : "Featured",
      description: item.is_featured
        ? `${item.name} is off the home page.`
        : `${item.name} now shows on the home page.`,
    })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await del.mutateAsync(pendingDelete.id)
      toast({ title: "Product deleted", description: `${pendingDelete.name} has been removed.` })
    } catch (err) {
      toast({ title: "Can't delete this product", description: err.message, variant: "destructive" })
    } finally {
      setPendingDelete(null)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await fetchAllAdminProducts({ ...filters, page: undefined, limit: undefined })
      downloadCsv(`jvigor-products-${new Date().toISOString().slice(0, 10)}.csv`, rows, CSV_COLUMNS)
      toast({ title: `Exported ${rows.length} product${rows.length === 1 ? "" : "s"}` })
    } catch (err) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const copySku = (item) => {
    navigator.clipboard?.writeText(item.sku)
    toast({ title: `Copied ${item.sku}` })
  }

  const setColumn = (key, on) => {
    const next = { ...columns, [key]: on }
    setColumns(next)
    writeStored(COLUMNS_KEY, next)
  }

  const reset = () => {
    setSearchInput("")
    setFilters({ status: "all", search: "", category: "all" })
  }

  const selectedItems = items.filter((i) => selected.has(i.id))
  const selectedIds = selectedItems.map((i) => i.id)
  const from = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const to = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-bold">Products</h1>
            <LiveIndicator now={now} source="stock" />
          </div>
          {summary.isLoading ? (
            <Skeleton className="h-4 w-60" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {(summary.data?.counts?.all ?? pagination.total).toLocaleString("en-NG")} in the catalogue.
              Stock updates here as orders are paid and stock is adjusted.
            </p>
          )}
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
            aria-label="Refresh products"
          >
            <RefreshCw data-icon="inline-start" className={isFetching ? "motion-safe:animate-spin" : undefined} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || !pagination.total}>
            {exporting ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
            Export CSV
          </Button>
          <AlertSettings />
          <Button size="sm" asChild>
            <Link href="/admin/products/new">
              <Plus data-icon="inline-start" />
              New product
            </Link>
          </Button>
        </div>
      </div>

      <CatalogHealth
        summary={summary.data}
        active={filters.status}
        onSelect={(status) => setFilters({ status })}
        onUncategorised={() => setFilters({ category: "none", status: "all" })}
        loading={summary.isLoading}
      />

      <BulkActions ids={selectedIds} selectedItems={selectedItems} onClear={() => setSelected(new Set())} />

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Products didn&apos;t load</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            Check your connection and try again. If it keeps failing, confirm migrations 002 and 003 have run.
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearchInput("")}
                placeholder="Search name, SKU or brand"
                className="pl-9 pr-10"
                aria-label="Search products"
              />
              <Kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
            </div>

            <Select value={filters.category} onValueChange={(category) => setFilters({ category })}>
              <SelectTrigger className="w-[190px]" aria-label="Category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {" ".repeat(c.depth * 3)}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={filters.sort} onValueChange={(sort) => setFilters({ sort })}>
              <SelectTrigger className="w-[190px]" aria-label="Sort">
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
                <DropdownMenuCheckboxItem checked={columns.category} onCheckedChange={(v) => setColumn("category", v)}>
                  Category
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={columns.margin} onCheckedChange={(v) => setColumn("margin", v)}>
                  Margin
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={columns.updated} onCheckedChange={(v) => setColumn("updated", v)}>
                  Updated
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

          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package />
                </EmptyMedia>
                <EmptyTitle>
                  {hasFilters
                    ? filters.status === "low_stock" || filters.status === "out_of_stock"
                      ? "Nothing needs restocking here"
                      : "No products match these filters"
                    : "No products yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasFilters
                    ? "Try a different search, category or status."
                    : "Add your first product to start selling."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {hasFilters ? (
                  <Button variant="outline" onClick={reset}>
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/admin/products/new">
                      <Plus data-icon="inline-start" />
                      New product
                    </Link>
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <ProductsTable
                items={items}
                now={now}
                fresh={fresh}
                sort={filters.sort}
                onSort={(sort) => setFilters({ sort })}
                columns={columns}
                selected={selected}
                onSelectedChange={setSelected}
                onToggleActive={toggleActive}
                onToggleFeatured={toggleFeatured}
                onDelete={setPendingDelete}
                onCopy={copySku}
                busyIds={busyIds}
              />
            </div>
          )}

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

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Products that appear in past orders are protected: hide them from
              the shop instead, so order history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep product</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// useSearchParams needs a Suspense boundary to build in Next.js.
export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AdminProductsPageContent />
    </Suspense>
  )
}
