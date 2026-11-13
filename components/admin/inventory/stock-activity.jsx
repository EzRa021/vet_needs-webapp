"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { Activity, PackageMinus, PackagePlus, ShoppingCart } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { orderRef } from "@/lib/order-status"
import { describeMovement } from "@/lib/stock-movements"
import { fullDateTime, timeAgo } from "@/lib/relative-time"

function iconFor(entry) {
  if (entry.type === "sale") return { Icon: ShoppingCart, hue: "text-primary", tint: "bg-primary/10" }
  if (Number(entry.details?.changeAmount) > 0) return { Icon: PackagePlus, hue: "text-success", tint: "bg-success/10" }
  return { Icon: PackageMinus, hue: "text-earth", tint: "bg-earth/15" }
}

// The stock ledger as it happens: every sale, delivery and adjustment across
// the catalogue, newest first. Rows that arrive while the page is open slide
// in, so a sale landing is something you see, not something you infer.
export default function StockActivity({ entries, loading, now }) {
  const seen = useRef(null)

  // Everything in the first load is "old"; anything after it is new.
  const isNew = (id) => seen.current !== null && !seen.current.has(id)
  useEffect(() => {
    if (!entries) return
    if (seen.current === null) seen.current = new Set()
    // Mark after paint, so the new rows render once with their entrance.
    const t = setTimeout(() => entries.forEach((e) => seen.current.add(e.id)), 50)
    return () => clearTimeout(t)
  }, [entries])

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-2 md:px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-primary" aria-hidden="true" />
          Stock activity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {loading ? (
          <div className="flex flex-col gap-3 p-4 md:px-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !entries?.length ? (
          <p className="p-4 text-sm text-muted-foreground md:px-5">
            Sales, deliveries and adjustments show up here as they happen.
          </p>
        ) : (
          <ol className="flex max-h-[560px] flex-col overflow-y-auto" aria-live="polite" aria-label="Latest stock movements">
            {entries.map((entry) => {
              const { Icon, hue, tint } = iconFor(entry)
              const fresh = isNew(entry.id)
              const orderId = entry.type === "sale" ? entry.details?.orderId : null
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "flex gap-3 border-t px-4 py-3 first:border-t-0 md:px-5",
                    // One animation only: animate-in and row-flash both set
                    // `animation`, so stacking them would drop one.
                    fresh && "motion-safe:animate-row-flash"
                  )}
                >
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", tint)}>
                    <Icon className={cn("size-4", hue)} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${entry.item_id}`}
                      className="block truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      {entry.item?.name || "Deleted product"}
                    </Link>
                    <p className="text-sm text-muted-foreground">{describeMovement(entry)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <time dateTime={entry.created_at} title={fullDateTime(entry.created_at)}>
                        {timeAgo(entry.created_at, now)}
                      </time>
                      {orderId ? (
                        <>
                          {", "}
                          <Link href={`/admin/orders/${orderId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                            order {orderRef(orderId)}
                          </Link>
                        </>
                      ) : entry.actor ? (
                        `, by ${entry.actor}`
                      ) : null}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
