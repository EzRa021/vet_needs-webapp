"use client"

import { CircleCheck, CircleDashed, PackageX, TriangleAlert } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const SEGMENTS = [
  { key: "out", label: "Out of stock", icon: PackageX, bar: "bg-destructive", hue: "text-destructive" },
  { key: "low", label: "Low", icon: TriangleAlert, bar: "bg-earth", hue: "text-earth" },
  { key: "ok", label: "Healthy", icon: CircleCheck, bar: "bg-success", hue: "text-success" },
  { key: "untracked", label: "Not tracked", icon: CircleDashed, bar: "bg-muted-foreground/40", hue: "text-muted-foreground" },
]

// The whole catalogue as one bar: how much of it is out, low, or fine.
// Each part of the legend filters the table below to just those products.
export default function StockHealth({ totals, active, onSelect }) {
  const counts = {
    out: totals.out_of_stock,
    low: totals.low_stock,
    ok: totals.healthy,
    untracked: totals.untracked,
  }
  const total = Math.max(totals.products, 1)
  const needAction = counts.out + counts.low

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-4 md:p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Stock health</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {needAction === 0 ? "All stocked" : `${needAction} need${needAction === 1 ? "s" : ""} restocking`}
          </p>
        </div>

        <div aria-hidden="true" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-border">
          {SEGMENTS.map((s) =>
            counts[s.key] > 0 ? (
              <div
                key={s.key}
                className={cn("h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full", s.bar)}
                style={{ width: `${Math.max((counts[s.key] / total) * 100, 2)}%` }}
              />
            ) : null
          )}
        </div>

        <ul className="grid grid-cols-2 gap-1">
          {SEGMENTS.filter((s) => s.key !== "untracked" || counts.untracked > 0).map((s) => {
            const Icon = s.icon
            const isActive = active === s.key
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelect(isActive ? "all" : s.key)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-secondary ring-1 ring-inset ring-primary/40 hover:bg-secondary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={cn("size-4", s.hue)} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span key={counts[s.key]} className="font-semibold tabular-nums motion-safe:animate-in motion-safe:fade-in">
                    {counts[s.key]}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
