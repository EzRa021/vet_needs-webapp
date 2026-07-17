"use client"

import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
  Receipt,
  ShoppingCart,
  PackagePlus,
  History as HistoryIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatNaira } from "@/lib/pricing"

// Renders item_history rows. These are written automatically by the
// log_item_changes() DB trigger — creation, stock moves, price and VAT edits,
// and sales (tagged with the order id by mark_order_paid).
const TYPE_META = {
  creation: { label: "Created", icon: Sparkles, variant: "secondary" },
  restock: { label: "Restocked", icon: PackagePlus, variant: "secondary" },
  adjustment: { label: "Stock adjusted", icon: ArrowDownRight, variant: "secondary" },
  sale: { label: "Sold", icon: ShoppingCart, variant: "default" },
  price_update: { label: "Price changed", icon: Tag, variant: "secondary" },
  vat_update: { label: "VAT changed", icon: Receipt, variant: "secondary" },
}

// Reason codes written by adjust_stock() (021). Rendering the raw slug would
// make the whole feature look half-built the first time someone spoils a bag.
const REASON_LABEL = {
  restock: "Delivery from supplier",
  return: "Customer return",
  count_correction: "Stock count correction",
  damaged: "Damaged",
  expired: "Expired / spoiled",
  offline_sale: "Sold offline",
  sample: "Sample or giveaway",
  theft: "Loss / theft",
  other: "Other",
}

function describe(entry) {
  const d = entry.details || {}
  switch (entry.type) {
    case "creation":
      return `Added with ${d.initialStock ?? 0}${d.unitType === "kg" ? " kg" : ""} in stock at ${formatNaira(d.price)}`
    case "restock":
    case "adjustment":
    case "sale": {
      const change = Number(d.changeAmount ?? 0)
      const unit = d.unitType === "kg" ? " kg" : ""
      const dir = change > 0 ? "+" : ""
      const order = d.orderId ? ` · order #${String(d.orderId).slice(0, 8).toUpperCase()}` : ""
      return `${dir}${change}${unit} (${d.previousValue} → ${d.newValue})${order}`
    }
    case "price_update": {
      const parts = []
      if (d.previousPrice !== d.newPrice) {
        parts.push(`Price ${formatNaira(d.previousPrice)} → ${formatNaira(d.newPrice)}`)
      }
      if (d.previousCostPrice !== d.newCostPrice) {
        parts.push(`Cost ${formatNaira(d.previousCostPrice)} → ${formatNaira(d.newCostPrice)}`)
      }
      return parts.join(" · ") || "Price details updated"
    }
    case "vat_update": {
      const parts = []
      if (d.previousVatEnabled !== d.newVatEnabled) {
        parts.push(d.newVatEnabled ? "VAT turned on" : "VAT turned off")
      }
      if (d.previousVatRate !== d.newVatRate) {
        parts.push(`Rate ${d.previousVatRate}% → ${d.newVatRate}%`)
      }
      if (d.previousVatInclusive !== d.newVatInclusive) {
        parts.push(d.newVatInclusive ? "now inclusive" : "now exclusive")
      }
      return parts.join(" · ") || "VAT settings updated"
    }
    default:
      return ""
  }
}

export default function ProductHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>No history yet</EmptyTitle>
          <EmptyDescription>
            Stock, price and VAT changes are recorded here automatically.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ol className="flex flex-col">
      {history.map((entry, i) => {
        const meta = TYPE_META[entry.type] || {
          label: entry.type,
          icon: HistoryIcon,
          variant: "secondary",
        }
        const Icon =
          entry.type === "restock" || Number(entry.details?.changeAmount) > 0
            ? ArrowUpRight
            : meta.icon
        const last = i === history.length - 1

        return (
          <li key={entry.id} className="flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                <Icon className="size-4" />
              </span>
              {!last && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className={`flex-1 ${last ? "pb-0" : "pb-5"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <time className="text-xs text-muted-foreground" dateTime={entry.created_at}>
                  {new Date(entry.created_at).toLocaleString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p className="mt-1 text-sm tabular-nums">{describe(entry)}</p>

              {/* The reason is the whole point of 021 — "40 → 12" without it is
                  a permanent mystery. Older rows have none; they just don't show
                  this line rather than claiming "Unknown". */}
              {entry.details?.reason && (
                <p className="mt-0.5 text-sm">
                  <span className="font-medium">
                    {REASON_LABEL[entry.details.reason] || entry.details.reason}
                  </span>
                  {entry.details.note && (
                    <span className="text-muted-foreground"> — {entry.details.note}</span>
                  )}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                by {entry.created_by === "system" ? "system" : `user ${String(entry.created_by).slice(0, 8)}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
