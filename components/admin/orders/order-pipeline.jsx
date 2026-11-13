"use client"

import { Fragment } from "react"
import { ChevronRight, Inbox, TriangleAlert } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { FULFILMENT_FLOW, statusMeta } from "@/lib/order-status"
import { statusStyle } from "@/components/order-status-badge"

const OFF_FLOW = ["canceled", "refunded"]

function Segment({ status, count, active, onSelect, loading, note, compact }) {
  const isAll = status === "all"
  const Icon = isAll ? Inbox : statusStyle(status).icon
  const label = isAll ? "All orders" : statusMeta(status).label

  return (
    <button
      type="button"
      onClick={() => onSelect(status)}
      aria-pressed={active}
      className={cn(
        "group flex h-full w-full min-w-[112px] flex-col justify-between gap-1 rounded-lg px-3 py-2 text-left outline-none transition-colors",
        "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-secondary ring-1 ring-inset ring-primary/40 hover:bg-secondary",
        compact && "min-w-[96px]"
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-aria-pressed:text-foreground">
        <Icon className={cn("size-3.5 shrink-0", isAll ? "text-muted-foreground" : statusStyle(status).hue)} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
      </span>
      {loading ? (
        <Skeleton className="h-6 w-10" />
      ) : (
        // Keyed on the value so a live change re-enters, which is the cue
        // that this number just moved.
        <span
          key={count}
          className={cn(
            "font-display text-xl font-bold leading-none tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
            compact && "text-lg",
            count === 0 && "text-muted-foreground/60"
          )}
        >
          {count.toLocaleString("en-NG")}
        </span>
      )}
      {note}
    </button>
  )
}

// The fulfilment journey as the filter: each step shows how many orders are
// sitting there right now, and clicking a step shows them. Canceled and
// refunded sit apart because they're exits from the journey, not steps on it.
export default function OrderPipeline({ counts, stale = 0, active, onSelect, loading }) {
  const c = counts || {}
  const get = (s) => c[s] || 0

  return (
    <nav aria-label="Filter orders by status" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-stretch gap-1 rounded-xl border bg-card p-1.5 shadow-card">
        <li className="flex-1">
          <Segment status="all" count={get("all")} active={active === "all"} onSelect={onSelect} loading={loading} />
        </li>
        <li aria-hidden="true" className="mx-1 my-2 w-px bg-border" />

        {FULFILMENT_FLOW.map((status, i) => (
          <Fragment key={status}>
            <li className="flex-1">
              <Segment
                status={status}
                count={get(status)}
                active={active === status}
                onSelect={onSelect}
                loading={loading}
                note={
                  status === "paid" && stale > 0 ? (
                    <span className="flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-destructive">
                      <TriangleAlert className="size-3" aria-hidden="true" />
                      {stale} waiting over 24 h
                    </span>
                  ) : null
                }
              />
            </li>
            {i < FULFILMENT_FLOW.length - 1 && (
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="size-4 text-muted-foreground/50" />
              </li>
            )}
          </Fragment>
        ))}

        <li aria-hidden="true" className="mx-1 my-2 w-px bg-border" />
        {OFF_FLOW.map((status) => (
          <li key={status}>
            <Segment
              status={status}
              count={get(status)}
              active={active === status}
              onSelect={onSelect}
              loading={loading}
              compact
            />
          </li>
        ))}
      </ol>
    </nav>
  )
}
