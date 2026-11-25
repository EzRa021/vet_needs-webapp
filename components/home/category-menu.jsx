"use client"

import Link from "next/link"
import { ChevronRight, LayoutGrid } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Categories to list: each department's categories, or the department itself
// when it has none. With one department (today: Pet) its name would only
// repeat what the whole shop is, so it isn't shown as a heading.
function groupsFrom(taxonomy) {
  const roots = taxonomy || []
  return roots.map((dept) => ({
    dept,
    items: dept.children?.length ? dept.children : [dept],
  }))
}

// Desktop: a list of categories beside the slider, the shop's departments one
// click away — for a pet owner the first question is what it's for.
export function CategoryMenu({ taxonomy = null, isLoading = false, className = "" }) {
  const groups = groupsFrom(taxonomy)
  const showDept = groups.length > 1

  // As tall as the slider beside it, whatever height that is (picture-only
  // slides take their picture's shape): the list sits in an absolutely placed
  // box, so it never stretches the row, and scrolls if it's longer.
  return (
    <div className={cn("relative min-h-[320px]", className)}>
    <nav
      aria-label="Shop by category"
      className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border bg-card"
    >
      <p className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
        <LayoutGrid className="size-4" aria-hidden="true" />
        Shop by category
      </p>
      <div className="flex-1 overflow-y-auto py-1.5">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="mx-4 my-2.5 h-4 w-3/4" />
            ))
          : groups.map(({ dept, items }) => (
              <div key={dept.id}>
                {showDept && (
                  <Link
                    href={`/shop/category/${dept.id}`}
                    className="block px-4 pb-1 pt-3 text-xs font-semibold text-muted-foreground hover:text-primary"
                  >
                    {dept.name}
                  </Link>
                )}
                <ul>
                  {items.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/shop/category/${c.id}`}
                        className="group flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <span className="truncate">{c.name}</span>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
      </div>
      <Link
        href="/shop"
        className="border-t px-4 py-3 text-sm font-semibold text-primary hover:bg-accent"
      >
        All products
      </Link>
    </nav>
    </div>
  )
}

// Phone and tablet: the same categories as a row of chips under the slider.
export function CategoryChips({ taxonomy = null, isLoading = false, className = "" }) {
  const items = groupsFrom(taxonomy).flatMap((g) => g.items)
  if (!isLoading && items.length === 0) return null

  const chip =
    "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary"

  return (
    <nav aria-label="Shop by category" className={className}>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li>
          <Link href="/shop" className={cn(chip, "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}>
            All products
          </Link>
        </li>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-11 w-28 rounded-full" />
              </li>
            ))
          : items.map((c) => (
              <li key={c.id}>
                <Link href={`/shop/category/${c.id}`} className={chip}>
                  {c.name}
                </Link>
              </li>
            ))}
      </ul>
    </nav>
  )
}
