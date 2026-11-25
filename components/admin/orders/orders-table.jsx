"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CircleCheck,
  Clock3,
  Copy,
  ExternalLink,
  Mail,
  MoreHorizontal,
  Phone,
  Printer,
  StickyNote,
  Store,
  TriangleAlert,
  Truck,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
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
import BrandImage from "@/components/brand-image"
import { OrderProgressTicks, OrderStatusBadge, statusStyle } from "@/components/order-status-badge"
import { cn } from "@/lib/utils"
import { formatNaira } from "@/lib/pricing"
import { formatQuantity } from "@/lib/units"
import { duration, fullDateTime, timeAgo } from "@/lib/relative-time"
import { ALLOWED_TRANSITIONS, orderRef, parseShippingAddress } from "@/lib/order-status"
import { deliveryFeeLabel, isQuoteDelivery } from "@/lib/delivery"

const NEW_FOR_MS = 15 * 60 * 1000
const FLASH_FOR_MS = 6 * 1000
const STALE_PAID_MS = 24 * 60 * 60 * 1000

// Verbs for moving an order on, in the order staff reach for them.
const MOVE_LABEL = {
  processing: "Start processing",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  canceled: "Cancel order",
}

const stop = (e) => e.stopPropagation()

// Clicking anywhere on a row expands it, except on things that do their own job.
const isInteractive = (target) =>
  Boolean(target.closest("a, button, input, label, [role='checkbox'], [role='menuitem'], [data-no-expand]"))

function SortHeader({ label, column, sort, onSort, className }) {
  const [desc, asc] = column === "date" ? ["newest", "oldest"] : ["total_desc", "total_asc"]
  const active = sort === desc || sort === asc
  const Icon = !active ? ArrowUpDown : sort === desc ? ArrowDown : ArrowUp
  return (
    <TableHead
      className={className}
      aria-sort={!active ? "none" : sort === desc ? "descending" : "ascending"}
    >
      <button
        type="button"
        onClick={() => onSort(sort === desc ? asc : desc)}
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

// One line under the status badge saying how long it's been sitting there —
// the thing that actually decides what to pick up next.
function StatusAge({ order, now }) {
  if (order.status === "paid" && order.paid_at) {
    const waited = now - new Date(order.paid_at).getTime()
    const stale = waited > STALE_PAID_MS
    return (
      <span className={cn("flex items-center gap-1 text-xs", stale ? "font-medium text-destructive" : "text-muted-foreground")}>
        {stale && <TriangleAlert className="size-3" aria-hidden="true" />}
        Waiting {duration(waited)}
      </span>
    )
  }
  if (order.status === "pending") {
    return (
      <span className="text-xs text-muted-foreground">
        Unpaid for {duration(now - new Date(order.created_at).getTime())}
      </span>
    )
  }
  if (order.status === "processing" || order.status === "shipped") {
    return <span className="text-xs text-muted-foreground">Updated {timeAgo(order.updated_at, now)}</span>
  }
  return null
}

function PaymentCell({ order, now }) {
  if (order.status === "refunded") {
    return <span className="text-sm text-muted-foreground">Refunded</span>
  }
  if (order.paid_at) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1 text-sm font-medium">
          <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
          Paid
        </span>
        <time dateTime={order.paid_at} title={fullDateTime(order.paid_at)} className="text-xs text-muted-foreground">
          {timeAgo(order.paid_at, now)}
        </time>
      </div>
    )
  }
  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <Clock3 className="size-3.5" aria-hidden="true" />
      {order.status === "canceled" ? "Not paid" : "Unpaid"}
    </span>
  )
}

function Detail({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium tabular-nums">{children}</span>
    </div>
  )
}

function ExpandedOrder({ order, address }) {
  const items = Array.isArray(order.order_items) ? order.order_items : []
  return (
    <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] md:p-5">
      <section aria-label="Items" className="flex flex-col gap-3">
        <h4 className="font-display text-sm font-semibold">Items</h4>
        <ul className="flex flex-col gap-2.5">
          {items.map((item, i) => (
            <li key={`${item.id}-${i}`} className="flex items-center gap-3">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-surface-2">
                <BrandImage src={item.image} alt="" fill sizes="40px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/products/${item.id}`}
                  className="block truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {item.name}
                </Link>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatQuantity(item.quantity, item.unit_type)} at {formatNaira(item.price)}
                </span>
              </div>
              <span className="text-sm font-medium tabular-nums">{formatNaira(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col border-t pt-2">
          {order.subtotal != null && <Detail label="Subtotal">{formatNaira(order.subtotal)}</Detail>}
          {order.shipping_fee != null && (
            <Detail label="Delivery">{deliveryFeeLabel(order)}</Detail>
          )}
          {Number(order.tax_amount) > 0 && <Detail label="VAT added">{formatNaira(order.tax_amount)}</Detail>}
          {Number(order.discount_amount) > 0 && (
            <Detail label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`}>
              −{formatNaira(order.discount_amount)}
            </Detail>
          )}
          <Detail label="Total">
            <span className="font-display text-base font-bold">{formatNaira(order.total_amount)}</span>
          </Detail>
        </div>
      </section>

      <section aria-label="Delivery" className="flex flex-col gap-3">
        <h4 className="font-display text-sm font-semibold">
          {order.fulfilment_method === "pickup" ? "Store pickup" : "Deliver to"}
        </h4>
        <address className="whitespace-pre-line text-sm not-italic text-muted-foreground">
          {address.lines.length ? address.lines.join("\n") : "No address on file"}
        </address>
        <div className="flex flex-col gap-1.5">
          {(address.phone || order.customerPhone) && (
            <a
              href={`tel:${(address.phone || order.customerPhone).replace(/\s+/g, "")}`}
              className="flex w-fit items-center gap-2 text-sm font-medium hover:text-primary hover:underline"
            >
              <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {address.phone || order.customerPhone}
            </a>
          )}
          {(order.email || address.email) && (
            <a
              href={`mailto:${order.email || address.email}`}
              className="flex w-fit min-w-0 items-center gap-2 text-sm font-medium hover:text-primary hover:underline"
            >
              <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{order.email || address.email}</span>
            </a>
          )}
        </div>
        {order.tracking_number && (
          <p className="flex items-center gap-2 text-sm">
            <Truck className="size-3.5 text-muted-foreground" aria-hidden="true" />
            Tracking <span className="font-medium">{order.tracking_number}</span>
          </p>
        )}
      </section>

      <section aria-label="Payment and notes" className="flex flex-col gap-3">
        <h4 className="font-display text-sm font-semibold">Payment and notes</h4>
        <div className="flex flex-col">
          <Detail label="Reference">
            {order.payment_reference ? (
              <span className="break-all text-xs">{order.payment_reference}</span>
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </Detail>
          <Detail label="Placed">{fullDateTime(order.created_at)}</Detail>
          {order.paid_at && <Detail label="Paid">{fullDateTime(order.paid_at)}</Detail>}
        </div>
        {order.notes && (
          <div className="rounded-lg border bg-card p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Customer note</p>
            <p className="whitespace-pre-line text-sm">{order.notes}</p>
          </div>
        )}
        {order.admin_notes && (
          <div className="rounded-lg border border-earth/40 bg-earth/10 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <StickyNote className="size-3" aria-hidden="true" />
              Internal note
            </p>
            <p className="whitespace-pre-line text-sm">{order.admin_notes}</p>
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button size="sm" asChild>
            <Link href={`/admin/orders/${order.id}`}>
              <ExternalLink data-icon="inline-start" />
              Open order
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/orders/${order.id}/print`}>
              <Printer data-icon="inline-start" />
              Packing slip
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

function RowActions({ order, onMove, onCopy, busy }) {
  const moves = ALLOWED_TRANSITIONS[order.status] || []
  const forward = moves.filter((s) => s !== "canceled")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={busy} onClick={stop}>
          {busy ? <Spinner /> : <MoreHorizontal />}
          <span className="sr-only">Actions for order {orderRef(order.id)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={stop}>
        <DropdownMenuLabel className="tabular-nums">Order {orderRef(order.id)}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/admin/orders/${order.id}`}>
              <ExternalLink />
              Open order
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/orders/${order.id}/print`}>
              <Printer />
              Print packing slip
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCopy(order)}>
            <Copy />
            Copy order number
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {forward.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {forward.map((s) => {
                const Icon = statusStyle(s).icon
                return (
                  <DropdownMenuItem key={s} onSelect={() => onMove(order, s)}>
                    <Icon className={statusStyle(s).hue} />
                    {MOVE_LABEL[s]}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </>
        )}
        {moves.includes("canceled") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onMove(order, "canceled")}
            >
              <XCircle />
              Cancel order
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function OrdersTable({
  orders,
  now,
  fresh,
  sort,
  onSort,
  columns,
  selected,
  onSelectedChange,
  onMove,
  onCopy,
  busyIds,
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [confirmCancel, setConfirmCancel] = useState(null)

  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id))
  const someSelected = orders.some((o) => selected.has(o.id))
  const toggleAll = () =>
    onSelectedChange(allSelected ? new Set() : new Set(orders.map((o) => o.id)))
  const toggleOne = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelectedChange(next)
  }

  const requestMove = (order, status) =>
    status === "canceled" ? setConfirmCancel(order) : onMove(order, status)

  const colCount = 6 + (columns.items ? 1 : 0) + (columns.delivery ? 1 : 0) + (columns.payment ? 1 : 0) + 1

  return (
    <>
      <Table className="min-w-[760px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all orders on this page"
              />
            </TableHead>
            <SortHeader label="Order" column="date" sort={sort} onSort={onSort} />
            <TableHead>Customer</TableHead>
            {columns.items && <TableHead className="hidden md:table-cell">Items</TableHead>}
            {columns.delivery && <TableHead className="hidden xl:table-cell">Delivery</TableHead>}
            {columns.payment && <TableHead className="hidden lg:table-cell">Payment</TableHead>}
            <TableHead>Status</TableHead>
            <SortHeader label="Total" column="total" sort={sort} onSort={onSort} className="text-right [&>button]:ml-auto [&>button]:flex" />
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
            <TableHead className="w-10 pr-4">
              <span className="sr-only">Expand</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const address = parseShippingAddress(o.shipping_address)
            const name = o.customerName || address.name || o.email || "Customer"
            const contact = address.phone || o.customerPhone || o.email || address.email
            const items = Array.isArray(o.order_items) ? o.order_items : []
            const isOpen = expanded.has(o.id)
            const isSelected = selected.has(o.id)
            const live = fresh[o.id]
            const flashing = live && now - live.at < FLASH_FOR_MS
            const isNew =
              now - new Date(o.created_at).getTime() < NEW_FOR_MS && ["pending", "paid"].includes(o.status)
            const justPaid = live?.kind === "paid"
            const detailId = `order-detail-${o.id}`

            return (
              <OrderRowGroup key={o.id}>
                <TableRow
                  // Re-keyed on the live timestamp so the flash replays for
                  // every change, not just the first.
                  key={`${o.id}-${live?.at || 0}`}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={(e) => !isInteractive(e.target) && toggleExpanded(o.id)}
                  className={cn(
                    "cursor-pointer align-top [&>td]:py-3",
                    flashing && "motion-safe:animate-row-flash",
                    isOpen && "border-b-0 bg-muted/30 hover:bg-muted/30"
                  )}
                >
                  <TableCell
                    className={cn(
                      "pl-4",
                      // A brand-green edge marks rows that arrived live, so
                      // they stay findable after the wash fades.
                      (isNew || flashing) && "shadow-[inset_3px_0_0_hsl(var(--primary))]"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(o.id)}
                      aria-label={`Select order ${orderRef(o.id)}`}
                      className="mt-0.5"
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-semibold tabular-nums hover:text-primary hover:underline"
                        >
                          {orderRef(o.id)}
                        </Link>
                        {isNew && (
                          <span className="rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold leading-4 text-primary-foreground">
                            New
                          </span>
                        )}
                        {justPaid && !isNew && (
                          <span className="rounded-full bg-success/15 px-1.5 py-px text-[11px] font-semibold leading-4 text-foreground">
                            Just paid
                          </span>
                        )}
                      </span>
                      <time
                        dateTime={o.created_at}
                        title={fullDateTime(o.created_at)}
                        className="text-xs text-muted-foreground"
                      >
                        {timeAgo(o.created_at, now)}
                      </time>
                    </div>
                  </TableCell>

                  <TableCell className="max-w-[220px]">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{name}</span>
                        {o.isGuest && (
                          <span className="shrink-0 rounded border px-1 text-[11px] leading-4 text-muted-foreground">
                            Guest
                          </span>
                        )}
                      </span>
                      {contact && <span className="truncate text-xs text-muted-foreground">{contact}</span>}
                    </div>
                  </TableCell>

                  {columns.items && (
                    <TableCell className="hidden max-w-[220px] md:table-cell">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm">{items[0]?.name || "No items"}</span>
                        <span className="text-xs text-muted-foreground">
                          {o.lineCount > 1
                            ? `+${o.lineCount - 1} more, ${o.lineCount} products`
                            : items[0]?.unit_type === "kg"
                              ? formatQuantity(items[0].quantity, "kg")
                              : `Qty ${formatQuantity(items[0]?.quantity || 0)}`}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  {columns.delivery && (
                    <TableCell className="hidden max-w-[180px] xl:table-cell">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {o.fulfilment_method === "pickup" ? (
                          <span className="flex min-w-0 items-center gap-1 text-sm">
                            <Store className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate">Store pickup</span>
                          </span>
                        ) : (
                          <span className="truncate text-sm">
                            {o.delivery?.area
                              ? `${o.delivery.area.name}, ${o.delivery.area.city}`
                              : [address.city, address.state].filter(Boolean).join(", ") || "—"}
                          </span>
                        )}
                        {o.fulfilment_method === "pickup" ? null : o.tracking_number ? (
                          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            <Truck className="size-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{o.tracking_number}</span>
                          </span>
                        ) : (
                          o.status === "shipped" && (
                            <span className="text-xs text-muted-foreground">No tracking number</span>
                          )
                        )}
                      </div>
                    </TableCell>
                  )}

                  {columns.payment && (
                    <TableCell className="hidden lg:table-cell">
                      <PaymentCell order={o} now={now} />
                    </TableCell>
                  )}

                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <OrderStatusBadge status={o.status} method={o.fulfilment_method} />
                      <OrderProgressTicks status={o.status} />
                      <StatusAge order={o} now={now} />
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-semibold tabular-nums">{formatNaira(o.total_amount)}</span>
                      {Number(o.discount_amount) > 0 ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          −{formatNaira(o.discount_amount)}
                          {o.coupon_code ? ` ${o.coupon_code}` : ""}
                        </span>
                      ) : (
                        o.shipping_fee != null && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {isQuoteDelivery(o)
                              ? "Delivery fee to agree"
                              : Number(o.shipping_fee) === 0
                                ? "Free delivery"
                                : `${formatNaira(o.shipping_fee)} delivery`}
                          </span>
                        )
                      )}
                    </div>
                  </TableCell>

                  <TableCell data-no-expand>
                    <RowActions order={o} onMove={requestMove} onCopy={onCopy} busy={busyIds.has(o.id)} />
                  </TableCell>

                  <TableCell className="pr-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-expanded={isOpen}
                      aria-controls={detailId}
                      onClick={() => toggleExpanded(o.id)}
                    >
                      <ChevronDown className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
                      <span className="sr-only">{isOpen ? "Hide details" : "Show details"}</span>
                    </Button>
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow id={detailId} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={colCount} className="p-0">
                      <ExpandedOrder order={o} address={address} />
                    </TableCell>
                  </TableRow>
                )}
              </OrderRowGroup>
            )
          })}
        </TableBody>
      </Table>

      <AlertDialog open={Boolean(confirmCancel)} onOpenChange={(open) => !open && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order {confirmCancel && orderRef(confirmCancel.id)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCancel?.status === "pending"
                ? "It hasn't been paid, so nothing is charged. The customer sees it as canceled straight away."
                : "The order won't be fulfilled and the customer sees it as canceled straight away. Canceling doesn't return their money: issue the refund from Refunds."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onMove(confirmCancel, "canceled")
                setConfirmCancel(null)
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Rows come in pairs (summary + optional details); a fragment with a key.
function OrderRowGroup({ children }) {
  return <>{children}</>
}

export { MOVE_LABEL }
