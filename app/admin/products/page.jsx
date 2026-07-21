"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
  TriangleAlert,
  Star,
  X,
  Eye,
  Download,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import BulkActions from "@/components/admin/bulk-actions"
import { downloadCsv } from "@/lib/csv"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import BrandImage from "@/components/brand-image"
import {
  useAdminProducts,
  useAdminTaxonomy,
  useDeleteProduct,
  useSaveProduct,
} from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"

const STATUS_FILTERS = [
  { value: "all", label: "All products" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "featured", label: "Featured" },
  { value: "out_of_stock", label: "Out of stock" },
]

function flatten(nodes, out = [], depth = 0) {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) flatten(n.children, out, depth + 1)
  }
  return out
}

function StockCell({ item }) {
  const stock = Number(item.stock)
  const low = stock <= Number(item.low_stock_threshold ?? 10)
  const unit = item.unit_type === "kg" ? " kg" : ""
  if (stock === 0) {
    return <Badge variant="destructive">Out of stock</Badge>
  }
  return (
    <span className={`tabular-nums ${low ? "font-semibold text-destructive" : ""}`}>
      {stock}
      {unit}
      {low && <span className="ml-1 text-xs font-normal">low</span>}
    </span>
  )
}

export default function AdminProductsPage() {
  const { toast } = useToast()
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    status: "all",
    page: 1,
    limit: 20,
  })
  const [searchInput, setSearchInput] = useState("")
  const [pendingDelete, setPendingDelete] = useState(null)

  const { data, isLoading, isError } = useAdminProducts(filters)
  const { data: tree } = useAdminTaxonomy()
  const del = useDeleteProduct()
  const save = useSaveProduct()

  const items = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, pages: 0 }
  const categories = flatten(tree || [])
  const hasFilters = filters.search || filters.category !== "all" || filters.status !== "all"

  // Selection is scoped to the current page and cleared whenever the list
  // changes underneath it. Carrying a selection across a filter change means
  // acting on rows you can no longer see — which is how a bulk edit hits
  // products nobody intended.
  const [selected, setSelected] = useState(() => new Set())
  const visibleIds = items.map((i) => i.id)
  const selectedOnPage = visibleIds.filter((id) => selected.has(id))
  const allSelected = visibleIds.length > 0 && selectedOnPage.length === visibleIds.length

  const clearSelection = () => setSelected(new Set())

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visibleIds))

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Any change to what's listed drops the selection.
  const updateFilters = (patch) => {
    clearSelection()
    setFilters((f) => ({ ...f, ...patch }))
  }

  const selectedItems = items.filter((i) => selected.has(i.id))

  const update = (patch) => {
    clearSelection()
    setFilters((f) => ({ ...f, ...patch, page: 1 }))
  }

  const toggleActive = async (item) => {
    try {
      await save.mutateAsync({ id: item.id, is_active: !item.is_active })
      toast({
        title: item.is_active ? "Product hidden" : "Product is live",
        description: `“${item.name}” is now ${item.is_active ? "inactive" : "active"}.`,
      })
    } catch (err) {
      toast({ title: "Couldn't update", description: err.message, variant: "destructive" })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await del.mutateAsync(pendingDelete.id)
      toast({ title: "Product deleted", description: `“${pendingDelete.name}” has been removed.` })
    } catch (err) {
      toast({ title: "Can't delete this product", description: err.message, variant: "destructive" })
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} item{pagination.total === 1 ? "" : "s"} in your catalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={items.length === 0}
            onClick={() =>
              downloadCsv(
                `vetneeds-products-${new Date().toISOString().slice(0, 10)}.csv`,
                items,
                [
                  { key: "sku", label: "SKU" },
                  { key: "name", label: "Name" },
                  { key: "brand", label: "Brand" },
                  { key: "category", label: "Category", format: (c) => c?.name || "" },
                  { key: "price", label: "Price (NGN)" },
                  { key: "compare_at_price", label: "Compare at" },
                  { key: "cost_price", label: "Cost" },
                  { key: "stock", label: "Stock" },
                  { key: "unit_type", label: "Unit" },
                  { key: "vat_enabled", label: "VAT", format: (v) => (v ? "Yes" : "Exempt") },
                  { key: "vat_rate", label: "VAT %" },
                  {
                    key: "vat_inclusive",
                    label: "VAT treatment",
                    format: (v) => (v ? "Inclusive" : "Added"),
                  },
                  { key: "is_active", label: "Status", format: (v) => (v ? "Live" : "Hidden") },
                ]
              )
            }
          >
            <Download data-icon="inline-start" />
            Export
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus data-icon="inline-start" />
              New product
            </Link>
          </Button>
        </div>
      </div>

      <BulkActions
        ids={selectedOnPage}
        selectedItems={selectedItems}
        onClear={clearSelection}
      />

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load products</AlertTitle>
          <AlertDescription>Refresh the page, or check migrations 002 and 003.</AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 py-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <form
              className="relative min-w-[200px] flex-1"
              onSubmit={(e) => {
                e.preventDefault()
                update({ search: searchInput })
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, SKU or brand…"
                className="pl-9"
                aria-label="Search products"
              />
            </form>

            <Select value={filters.category} onValueChange={(v) => update({ category: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {" ".repeat(c.depth * 3)}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput("")
                  setFilters({ search: "", category: "all", status: "all", page: 1, limit: 20 })
                }}
              >
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
            ) : items.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Package />
                  </EmptyMedia>
                  <EmptyTitle>
                    {hasFilters ? "No products match those filters" : "No products yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? "Try a different search or clear the filters."
                      : "Add your first product to start selling."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {hasFilters ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchInput("")
                        setFilters({ search: "", category: "all", status: "all", page: 1, limit: 20 })
                      }}
                    >
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          // "Select all" that silently means "all 20 on this
                          // page" is how people bulk-edit things they never saw.
                          aria-label={`Select all ${items.length} products on this page`}
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        data-state={selected.has(item.id) ? "selected" : undefined}
                        className={!item.is_active ? "opacity-60" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleOne(item.id)}
                            aria-label={`Select ${item.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                              <BrandImage
                                src={item.image_url}
                                alt={item.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/admin/products/${item.id}`}
                                  className="truncate font-medium hover:text-primary hover:underline"
                                >
                                  {item.name}
                                </Link>
                                {item.is_featured && (
                                  <Star className="size-3.5 shrink-0 fill-earth text-earth" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {item.sku || "No SKU"}
                                {item.brand ? ` · ${item.brand}` : ""}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {item.category?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium tabular-nums">
                              {formatNaira(item.price)}
                            </span>
                            {item.unit_type === "kg" && (
                              <span className="text-xs text-muted-foreground">per kg</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StockCell item={item} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? "secondary" : "outline"}>
                            {item.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal />
                                <span className="sr-only">Actions for {item.name}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/products/${item.id}`}>
                                    <Eye />
                                    View details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/products/${item.id}/edit`}>
                                    <Pencil />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleActive(item)}>
                                  <Package />
                                  {item.is_active ? "Set inactive" : "Set active"}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setPendingDelete(item)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
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

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Products that appear in past orders are
              protected — set them inactive instead so order history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
