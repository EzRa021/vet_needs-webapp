"use client"

import { Check, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { FULFILMENT_FLOW, statusMeta, isTerminal } from "@/lib/order-status"

// The happy-path journey, with everything after the order's current step shown
// as still to come. Shared by the checkout success page and the order tracking
// page so the two can't tell a customer different stories about the same order.
export default function FulfilmentTimeline({ status, className }) {
  // A canceled or refunded order never reaches "delivered", so drawing a
  // progress track would imply it's still on its way. Say what happened instead.
  if (isTerminal(status)) {
    const meta = statusMeta(status)
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-dashed p-4",
          className
        )}
      >
        <XCircle className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
      </div>
    )
  }

  const currentIndex = FULFILMENT_FLOW.indexOf(status)

  return (
    <ol className={cn("grid gap-4 sm:grid-cols-5", className)}>
      {FULFILMENT_FLOW.map((step, i) => {
        const done = currentIndex >= 0 && i <= currentIndex
        const current = i === currentIndex
        return (
          <li key={step} className="flex flex-col items-center gap-2 text-center">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                // The step they're actually on is the one they came to find.
                current && "ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                !done && "text-muted-foreground",
                current && "text-primary"
              )}
            >
              {statusMeta(step).label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
