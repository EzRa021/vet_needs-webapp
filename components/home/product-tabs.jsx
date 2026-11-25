"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import ProductCard from "@/components/product-card"
import { cn } from "@/lib/utils"

// A tab is only worth showing with enough to fill a row.
const MIN_PER_TAB = 3

// Builds the tabs from what's actually in stock to show:
//   New arrivals   always, the newest products
//   Featured       the admin's picks, when there are enough
//   <Category>     up to three categories with enough products, biggest first
// `latest` is the newest products (one request); categories are grouped from it
// rather than fetched one by one.
export function buildTabs({ latest, featured }) {
  const tabs = []
  if (latest?.length) {
    tabs.push({ id: "new", label: "New arrivals", items: latest, href: "/shop?sortBy=created_at&sortOrder=desc" })
  }
  if (featured?.length >= MIN_PER_TAB) {
    tabs.push({ id: "featured", label: "Featured", items: featured, href: "/shop" })
  }
  const byCategory = new Map()
  for (const item of latest || []) {
    const c = item.category
    if (!c?.id) continue
    if (!byCategory.has(c.id)) byCategory.set(c.id, { id: c.id, label: c.name, items: [] })
    byCategory.get(c.id).items.push(item)
  }
  ;[...byCategory.values()]
    .filter((c) => c.items.length >= MIN_PER_TAB)
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 3)
    .forEach((c) => tabs.push({ ...c, id: `cat-${c.id}`, href: `/shop/category/${c.id}` }))
  return tabs
}

// Show only whole rows at every width: a tab of 7 shouldn't end on a row of 3.
// Columns per breakpoint, and how many rows at most:
//   beside the deal card: 2 cols (phone) ×3, 3 cols (sm) ×2, 4 cols (xl) ×2
//   full width:           2 ×3, 3 ×2, 4 cols (lg) ×2, 5 cols (xl) ×2
const wholeRows = (n, cols, rows) => (n < cols ? n : Math.min(cols * rows, Math.floor(n / cols) * cols))

// Literal class names (Tailwind only ships classes it can find in the code).
const SHOW = { base: "block", sm: "sm:block", lg: "lg:block", xl: "xl:block" }
const HIDE = { base: "hidden", sm: "sm:hidden", lg: "lg:hidden", xl: "xl:hidden" }

function visibility(i, n, besideDeal) {
  const counts = besideDeal
    ? { base: wholeRows(n, 2, 3), sm: wholeRows(n, 3, 2), xl: wholeRows(n, 4, 2) }
    : { base: wholeRows(n, 2, 3), sm: wholeRows(n, 3, 2), lg: wholeRows(n, 4, 2), xl: wholeRows(n, 5, 2) }
  return Object.entries(counts)
    .map(([bp, count]) => (i < count ? SHOW[bp] : HIDE[bp]))
    .join(" ")
}

/** @param {{ tabs?: any[], isLoading?: boolean, besideDeal?: boolean, className?: string }} props */
export default function ProductTabs({ tabs = [], isLoading = false, besideDeal = false, className = "" }) {
  const grid = cn(
    "grid grid-cols-2 gap-3 sm:grid-cols-3",
    besideDeal ? "xl:grid-cols-4" : "lg:grid-cols-4 xl:grid-cols-5"
  )

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <Skeleton className="h-9 w-72" />
        <div className={grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/5] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (!tabs?.length) return null

  return (
    <Tabs defaultValue={tabs[0].id} className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex items-end justify-between gap-3 border-b">
        <TabsList className="-mb-px h-auto justify-start gap-5 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-11 rounded-none border-b-2 border-transparent px-0 font-display text-base font-bold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none md:text-lg"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="mt-4 flex flex-col gap-4">
          <ul className={grid}>
            {t.items.slice(0, 10).map((item, i, shown) => (
              <li key={item.id} className={visibility(i, shown.length, besideDeal)}>
                <ProductCard item={item} />
              </li>
            ))}
          </ul>
          <Link
            href={t.href}
            className="inline-flex items-center gap-1 self-end text-sm font-semibold text-primary hover:underline"
          >
            See all {t.label.toLowerCase()}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </TabsContent>
      ))}
    </Tabs>
  )
}
