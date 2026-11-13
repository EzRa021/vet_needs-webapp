import {
  BadgeCheck,
  Clock3,
  PackageCheck,
  PackageOpen,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { FULFILMENT_FLOW, isTerminal, statusMeta } from "@/lib/order-status"

// Status reads by icon + words first; the tint only reinforces it (colour is
// never the only signal). Text stays text-foreground so it clears 4.5:1 on the
// tinted fill in both themes — only the icon carries the hue.
export const STATUS_STYLE = {
  pending: { icon: Clock3, tint: "border-earth/40 bg-earth/10", hue: "text-earth", bar: "bg-earth" },
  paid: { icon: BadgeCheck, tint: "border-primary/30 bg-primary/10", hue: "text-primary", bar: "bg-primary" },
  processing: { icon: PackageOpen, tint: "border-info/30 bg-info/10", hue: "text-info", bar: "bg-info" },
  shipped: { icon: Truck, tint: "border-info/30 bg-info/10", hue: "text-info", bar: "bg-info" },
  delivered: { icon: PackageCheck, tint: "border-success/35 bg-success/10", hue: "text-success", bar: "bg-success" },
  canceled: { icon: XCircle, tint: "border-destructive/30 bg-destructive/10", hue: "text-destructive", bar: "bg-destructive" },
  refunded: { icon: Undo2, tint: "border-border bg-muted", hue: "text-muted-foreground", bar: "bg-muted-foreground" },
}

export const statusStyle = (status) => STATUS_STYLE[status] || STATUS_STYLE.refunded

export function OrderStatusBadge({ status, className, size = "sm" }) {
  const meta = statusMeta(status)
  const style = statusStyle(status)
  const Icon = style.icon
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium text-foreground transition-colors duration-300",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        style.tint,
        className
      )}
    >
      <Icon className={cn(size === "lg" ? "size-4" : "size-3.5", style.hue)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

// Five ticks along the happy path, filled up to the current step. Decorative —
// the badge next to it says the same thing in words — so hidden from AT.
export function OrderProgressTicks({ status, className }) {
  if (isTerminal(status)) return null
  const current = FULFILMENT_FLOW.indexOf(status)
  const style = statusStyle(status)
  return (
    <span aria-hidden="true" className={cn("flex w-[84px] gap-0.5", className)}>
      {FULFILMENT_FLOW.map((step, i) => (
        <span
          key={step}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-500",
            i <= current ? style.bar : "bg-border"
          )}
        />
      ))}
    </span>
  )
}
