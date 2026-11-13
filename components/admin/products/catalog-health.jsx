"use client"

import { Coins, EyeOff, FolderX, ImageOff, Layers, PackageX, Star, Store, TriangleAlert } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Two groups, because they answer different questions:
//   catalogue  what's listed: everything, on sale, hidden, featured
//   stock      what needs buying: at the reorder point, or gone
const CATALOGUE = [
  { status: "all", label: "All products", icon: Layers, hue: "text-muted-foreground" },
  { status: "active", label: "On sale", icon: Store, hue: "text-primary" },
  { status: "inactive", label: "Hidden", icon: EyeOff, hue: "text-muted-foreground" },
  { status: "featured", label: "Featured", icon: Star, hue: "text-earth" },
]
const STOCK = [
  { status: "low_stock", label: "Low stock", icon: TriangleAlert, hue: "text-earth", warn: true },
  { status: "out_of_stock", label: "Out of stock", icon: PackageX, hue: "text-destructive", warn: true },
]

function Segment({ item, count, active, onSelect, loading }) {
  const Icon = item.icon
  const alarming = item.warn && count > 0
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(item.status)}
      className={cn(
        "group flex min-w-[108px] flex-1 flex-col justify-between gap-1 rounded-lg px-3 py-2 text-left outline-none transition-colors",
        "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-secondary ring-1 ring-inset ring-primary/40 hover:bg-secondary"
      )}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground group-aria-pressed:text-foreground">
        <Icon className={cn("size-3.5 shrink-0", item.hue)} aria-hidden="true" />
        {item.label}
      </span>
      {loading ? (
        <Skeleton className="h-6 w-10" />
      ) : (
        <span
          key={count}
          className={cn(
            "font-display text-xl font-bold leading-none tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
            count === 0 && "text-muted-foreground/60",
            alarming && item.status === "out_of_stock" && "text-destructive"
          )}
        >
          {(count ?? 0).toLocaleString("en-NG")}
        </span>
      )}
    </button>
  )
}

export default function CatalogHealth({ summary, active, onSelect, onUncategorised, loading }) {
  const counts = summary?.counts || {}
  const gaps = summary?.gaps || {}
  const gapItems = [
    gaps.no_image > 0 && { key: "no_image", icon: ImageOff, text: `${gaps.no_image} without a photo` },
    gaps.no_cost > 0 && {
      key: "no_cost",
      icon: Coins,
      text: `${gaps.no_cost} without a cost price, so margins can't be worked out`,
    },
    gaps.uncategorised > 0 && {
      key: "uncategorised",
      icon: FolderX,
      text: `${gaps.uncategorised} not in a category, so shoppers browsing won't find ${gaps.uncategorised === 1 ? "it" : "them"}`,
      onClick: onUncategorised,
    },
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Filter products" className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-stretch gap-1 rounded-xl border bg-card p-1.5 shadow-card">
          {CATALOGUE.map((item) => (
            <Segment
              key={item.status}
              item={item}
              count={counts[item.status === "all" ? "all" : item.status]}
              active={active === item.status}
              onSelect={onSelect}
              loading={loading}
            />
          ))}
          <span aria-hidden="true" className="mx-1 my-2 w-px bg-border" />
          {STOCK.map((item) => (
            <Segment
              key={item.status}
              item={item}
              count={counts[item.status]}
              active={active === item.status}
              onSelect={onSelect}
              loading={loading}
            />
          ))}
        </div>
      </nav>

      {gapItems.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          {gapItems.map((g) => {
            const Icon = g.icon
            const content = (
              <>
                <Icon className="size-3.5 shrink-0 text-earth" aria-hidden="true" />
                {g.text}
              </>
            )
            return (
              <li key={g.key}>
                {g.onClick ? (
                  <button
                    type="button"
                    onClick={g.onClick}
                    className="flex items-center gap-1.5 rounded underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5">{content}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
