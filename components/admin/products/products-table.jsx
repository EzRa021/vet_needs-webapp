"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import BrandImage from "@/components/brand-image"
import StockAdjust from "@/components/admin/stock-adjust"
import { StockLevel } from "@/components/admin/stock-level"
import { cn } from "@/lib/utils"
import { formatNaira } from "@/lib/pricing"
import { fullDateTime, timeAgo } from "@/lib/relative-time"
import { describeMovement, margin, netPrice, STOCK_TYPES } from "@/lib/stock-movements"
import { useAdminProduct } from "@/stores/adminStore"

const FLASH_FOR_MS = 6 * 1000
const CHANGE_CHIP_MS = 60 * 1000

const isInteractive = (target) =>
  Boolean(
    target.closest("a, button, input, label, [role='checkbox'], [role='switch'], [role='menuitem'], [role='dialog'], [data-no-expand]")
  )

export const vatText = (item) =>
  !item.vat_enabled
    ? "VAT exempt"
    : item.vat_inclusive
      ? `${Number(item.vat_rate)}% VAT included in the price`
      : `${Number(item.vat_rate)}% VAT added at checkout`

// Header that sorts. `desc`/`asc` are the sort keys it toggles between.
function SortHeader({ label, desc, asc, sort, onSort, className, first = "desc" }) {
  const active = sort === desc || sort === asc
  const Icon = !active ? ArrowUpDown : sort === desc ? ArrowDown : ArrowUp
  const next = !active ? (first === "desc" ? desc : asc) : sort === desc ? asc : desc
  return (
    <TableHead className={className} aria-sort={!active ? "none" : sort === desc ? "descending" : "ascending"}>
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground"
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  )
}

function Line({ label, children, strong }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right tabular-nums", strong ? "font-semibold" : "font-medium")}>{children}</span>
    </div>
  )
}

// The expanded row: pricing and margin, stock with its latest movements, and
// the product's catalogue details. History is fetched only when opened.
function ProductQuickView({ item }) {
  const { data: full, isLoading } = useAdminProduct(item.id)
  const m = margin(item)
  const movements = (full?.history || []).filter((h) => STOCK_TYPES.includes(h.type)).slice(0, 5)
  const tags = Array.isArray(item.tags) ? item.tags : []

  return (
    <div className="grid gap-6 p-4 md:grid-cols-3 md:p-5">
      <section aria-label="Pricing" className="flex flex-col">
        <h4 className="mb-2 font-display text-sm font-semibold">Pricing</h4>
        <Line label="Selling price">
          {formatNaira(item.price)}
          {item.unit_type === "kg" ? " / kg" : ""}
        </Line>
        {item.compare_at_price != null && Number(item.compare_at_price) > Number(item.price) && (
          <Line label="Was">
            <span className="text-muted-foreground line-through">{formatNaira(item.compare_at_price)}</span>
          </Line>
        )}
        <Line label="Without VAT">{formatNaira(netPrice(item))}</Line>
        <Line label="Cost">{item.cost_price == null ? <span className="text-muted-foreground">Not set</span> : formatNaira(item.cost_price)}</Line>
        <Line label="Margin" strong>
          {m ? (
            <span className={cn(m.amount < 0 && "text-destructive")}>
              {formatNaira(m.amount)} ({m.percent.toFixed(1)}%)
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">Add a cost price</span>
          )}
        </Line>
        <p className="mt-2 text-xs text-muted-foreground">{vatText(item)}.</p>
      </section>

      <section aria-label="Stock" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-display text-sm font-semibold">Stock</h4>
          <StockAdjust
            product={item}
            trigger={
              <Button size="sm" variant="outline">
                <PackagePlus data-icon="inline-start" />
                Adjust stock
              </Button>
            }
          />
        </div>
        <StockLevel
          stock={item.stock}
          threshold={item.low_stock_threshold}
          unitType={item.unit_type}
          allowBackorder={item.allow_backorder}
        />
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Latest movements</p>
          {isLoading ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {movements.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    <span className="font-medium text-foreground">{describeMovement(h)}</span>
                    {h.type === "sale" && h.details?.orderId ? " on an order" : ""}
                  </span>
                  <time dateTime={h.created_at} title={fullDateTime(h.created_at)} className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(h.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Details" className="flex flex-col gap-3">
        <h4 className="font-display text-sm font-semibold">Details</h4>
        {item.description ? (
          <p className="line-clamp-4 text-sm text-muted-foreground">{item.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No short description yet.</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 8).map((t) => (
              <span key={t} className="rounded-full border px-2 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button size="sm" asChild>
            <Link href={`/admin/products/${item.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit product
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/product/${item.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink data-icon="inline-start" />
              View in shop
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

function RowActions({ item, onToggleActive, onToggleFeatured, onDelete, onCopy }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal />
          <span className="sr-only">Actions for {item.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">{item.name}</DropdownMenuLabel>
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
          <DropdownMenuItem asChild>
            <Link href={`/product/${item.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              View in shop
            </Link>
          </DropdownMenuItem>
          {item.sku && (
            <DropdownMenuItem onSelect={() => onCopy(item)}>
              <Copy />
              Copy SKU
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onToggleFeatured(item)}>
            <Star />
            {item.is_featured ? "Remove from featured" : "Feature on home page"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggleActive(item)}>
            {item.is_active ? <EyeOff /> : <Eye />}
            {item.is_active ? "Hide from shop" : "Put on sale"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onDelete(item)} className="text-destructive focus:text-destructive">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function ProductsTable({
  items,
  now,
  fresh,
  sort,
  onSort,
  columns,
  selected,
  onSelectedChange,
  onToggleActive,
  onToggleFeatured,
  onDelete,
  onCopy,
  busyIds,
}) {
  const [expanded, setExpanded] = useState(() => new Set())

  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id))
  const someSelected = items.some((i) => selected.has(i.id))
  const toggleAll = () => onSelectedChange(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  const toggleOne = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelectedChange(next)
  }

  // checkbox, product, price, stock, in shop, actions, expand + optional ones
  const colCount = 7 + (columns.category ? 1 : 0) + (columns.margin ? 1 : 0) + (columns.updated ? 1 : 0)

  return (
    <Table className="min-w-[760px]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pl-4">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              // "Select all" that silently means "all 20 on this page" is how
              // people bulk-edit things they never saw — so say it.
              aria-label={`Select all ${items.length} products on this page`}
            />
          </TableHead>
          <SortHeader label="Product" desc="name_desc" asc="name_asc" first="asc" sort={sort} onSort={onSort} />
          {columns.category && <TableHead className="hidden md:table-cell">Category</TableHead>}
          <SortHeader
            label="Price"
            desc="price_desc"
            asc="price_asc"
            sort={sort}
            onSort={onSort}
            className="text-right [&>button]:ml-auto [&>button]:flex"
          />
          {columns.margin && <TableHead className="hidden text-right lg:table-cell">Margin</TableHead>}
          <SortHeader label="Stock" desc="stock_desc" asc="stock_asc" first="asc" sort={sort} onSort={onSort} />
          <TableHead>In shop</TableHead>
          {columns.updated && (
            <SortHeader label="Updated" desc="updated" asc="updated" sort={sort} onSort={onSort} className="hidden xl:table-cell" />
          )}
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
          <TableHead className="w-10 pr-4">
            <span className="sr-only">Expand</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isOpen = expanded.has(item.id)
          const isSelected = selected.has(item.id)
          const live = fresh[item.id]
          const flashing = live && now - live.at < FLASH_FOR_MS
          const change = live?.change && now - live.at < CHANGE_CHIP_MS ? live.change : null
          const m = margin(item)
          const busy = busyIds.has(item.id)
          const detailId = `product-detail-${item.id}`
          const discounted =
            item.compare_at_price != null && Number(item.compare_at_price) > Number(item.price)

          return (
            <ProductRowGroup key={item.id}>
              <TableRow
                key={`${item.id}-${live?.at || 0}`}
                data-state={isSelected ? "selected" : undefined}
                onClick={(e) => !isInteractive(e.target) && toggleExpanded(item.id)}
                className={cn(
                  "cursor-pointer align-top [&>td]:py-3",
                  flashing && "motion-safe:animate-row-flash",
                  isOpen && "border-b-0 bg-muted/30 hover:bg-muted/30"
                )}
              >
                <TableCell className={cn("pl-4", flashing && "shadow-[inset_3px_0_0_hsl(var(--primary))]")}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(item.id)}
                    aria-label={`Select ${item.name}`}
                    className="mt-0.5"
                  />
                </TableCell>

                <TableCell className="max-w-[320px]">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "relative size-11 shrink-0 overflow-hidden rounded-lg border bg-surface-2",
                        !item.is_active && "opacity-50 grayscale"
                      )}
                    >
                      <BrandImage src={item.image_url} alt="" fill sizes="44px" className="object-cover" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-1">
                        <Link
                          href={`/admin/products/${item.id}`}
                          className={cn(
                            "truncate font-medium hover:text-primary hover:underline",
                            !item.is_active && "text-muted-foreground"
                          )}
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => onToggleFeatured(item)}
                          disabled={busy}
                          aria-pressed={item.is_featured}
                          aria-label={item.is_featured ? `Remove ${item.name} from featured` : `Feature ${item.name}`}
                          title={item.is_featured ? "Featured on the home page" : "Feature on the home page"}
                          className="grid size-6 shrink-0 place-items-center rounded outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          <Star
                            className={cn(
                              "size-3.5 transition-colors",
                              item.is_featured ? "fill-earth text-earth" : "text-muted-foreground/50"
                            )}
                          />
                        </button>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[item.sku || "No SKU", item.brand].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {columns.category && (
                  <TableCell className="hidden max-w-[180px] md:table-cell">
                    <span className={cn("block truncate text-sm", !item.category && "text-muted-foreground")}>
                      {item.category?.name || "Uncategorised"}
                    </span>
                  </TableCell>
                )}

                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-semibold tabular-nums">{formatNaira(item.price)}</span>
                    {discounted ? (
                      <span className="text-xs tabular-nums text-muted-foreground line-through">
                        {formatNaira(item.compare_at_price)}
                      </span>
                    ) : item.unit_type === "kg" ? (
                      <span className="text-xs text-muted-foreground">per kg</span>
                    ) : null}
                  </div>
                </TableCell>

                {columns.margin && (
                  <TableCell className="hidden text-right lg:table-cell">
                    {m ? (
                      <span
                        className={cn("text-sm font-medium tabular-nums", m.amount < 0 && "text-destructive")}
                        title={`${formatNaira(m.amount)} per ${item.unit_type === "kg" ? "kg" : "unit"}, after VAT`}
                      >
                        {m.percent.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No cost</span>
                    )}
                  </TableCell>
                )}

                <TableCell>
                  <StockLevel
                    stock={item.stock}
                    threshold={item.low_stock_threshold}
                    unitType={item.unit_type}
                    allowBackorder={item.allow_backorder}
                    change={change}
                  />
                </TableCell>

                <TableCell>
                  <label className="flex w-fit cursor-pointer items-center gap-2" data-no-expand>
                    <Switch
                      checked={item.is_active}
                      disabled={busy}
                      onCheckedChange={() => onToggleActive(item)}
                      aria-label={item.is_active ? `Hide ${item.name} from the shop` : `Put ${item.name} on sale`}
                    />
                    <span className={cn("text-xs font-medium", !item.is_active && "text-muted-foreground")}>
                      {item.is_active ? "On sale" : "Hidden"}
                    </span>
                  </label>
                </TableCell>

                {columns.updated && (
                  <TableCell className="hidden xl:table-cell">
                    <time
                      dateTime={item.updated_at}
                      title={fullDateTime(item.updated_at)}
                      className="whitespace-nowrap text-xs text-muted-foreground"
                    >
                      {timeAgo(item.updated_at, now)}
                    </time>
                  </TableCell>
                )}

                <TableCell data-no-expand>
                  <RowActions
                    item={item}
                    onToggleActive={onToggleActive}
                    onToggleFeatured={onToggleFeatured}
                    onDelete={onDelete}
                    onCopy={onCopy}
                  />
                </TableCell>

                <TableCell className="pr-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <ChevronDown className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
                    <span className="sr-only">{isOpen ? "Hide details" : "Show details"}</span>
                  </Button>
                </TableCell>
              </TableRow>

              {isOpen && (
                <TableRow id={detailId} className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={colCount} className="p-0">
                    <ProductQuickView item={item} />
                  </TableCell>
                </TableRow>
              )}
            </ProductRowGroup>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ProductRowGroup({ children }) {
  return <>{children}</>
}

