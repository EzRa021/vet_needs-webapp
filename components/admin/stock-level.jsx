import { TriangleAlert, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatQuantity } from "@/lib/units"

// Stock as a number you can read and a bar you can scan.
//
// The bar's full width is three times the reorder point, with a tick at the
// reorder point itself, so "how close to reordering" reads at a glance across
// products with very different volumes (12 dog collars vs 400 kg of mash).
// Words carry the meaning ("Low", "Out"); colour only reinforces them.
export function StockLevel({ stock, threshold = 10, unitType, allowBackorder, change, className }) {
  const value = Number(stock ?? 0)
  const reorderAt = Math.max(Number(threshold ?? 10), 0)
  const scale = Math.max(reorderAt * 3, 1)
  const out = value <= 0
  const low = !out && value <= reorderAt
  const fill = Math.min(Math.max(value / scale, 0), 1) * 100

  return (
    <div className={cn("flex min-w-[112px] flex-col gap-1", className)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("font-medium tabular-nums", out && "text-destructive")}>
          {formatQuantity(Math.max(value, 0), unitType)}
        </span>
        {change ? (
          // The live delta, keyed so each change re-enters.
          <span
            key={`${change}-${value}`}
            className={cn(
              "rounded px-1 text-[11px] font-semibold tabular-nums leading-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1",
              change < 0 ? "bg-destructive/10 text-destructive" : "bg-success/15 text-foreground"
            )}
          >
            {change > 0 ? "+" : "−"}
            {formatQuantity(Math.abs(change), unitType)}
          </span>
        ) : null}
      </div>
      <div aria-hidden="true" className="relative h-1.5 w-full max-w-[120px] rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            out ? "bg-destructive" : low ? "bg-earth" : "bg-success"
          )}
          style={{ width: `${fill}%` }}
        />
        {/* The reorder point. */}
        <span className="absolute -top-0.5 left-1/3 h-2.5 w-px bg-foreground/40" />
      </div>
      {out ? (
        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
          <XCircle className="size-3" aria-hidden="true" />
          {allowBackorder ? "Out, backorders on" : "Out of stock"}
        </span>
      ) : low ? (
        <span className="flex items-center gap-1 text-xs font-medium text-foreground">
          <TriangleAlert className="size-3 text-earth" aria-hidden="true" />
          Low, reorder at {formatQuantity(reorderAt, unitType)}
        </span>
      ) : null}
    </div>
  )
}
