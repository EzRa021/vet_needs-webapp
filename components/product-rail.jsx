"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import ProductCard from "@/components/product-card"
import { cn } from "@/lib/utils"

// One card's width at each breakpoint: a little over two on a phone (the cut
// card says "swipe"), six on a wide screen.
const CARD = "w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[18.8%] xl:w-[15.8%]"

// A swipeable row of products (recently viewed, related, best sellers...).
//
// Renders NOTHING when empty rather than an empty state. A rail is a
// suggestion, not a promise — "You haven't viewed anything yet" is a box that
// takes up space to tell you something you already know.
export default function ProductRail({
  title,
  description = "",
  items,
  isLoading = false,
  href = "",
  hrefLabel = "See all",
  className = "",
  limit = 12,
}) {
  const scroller = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, items])

  const page = (dir) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" })
  }

  if (isLoading) {
    return (
      <section className={cn("flex flex-col gap-4", className)}>
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className={cn(CARD, "aspect-[3/5] rounded-xl")} />
          ))}
        </div>
      </section>
    )
  }

  if (!items || items.length === 0) return null
  const shown = items.slice(0, limit)
  const scrolls = !(edges.start && edges.end)

  return (
    <section className={cn("flex flex-col gap-4", className)} aria-label={title}>
      <div className="flex items-end justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="font-display text-xl font-bold md:text-2xl">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {href && (
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href={href}>
                {hrefLabel}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
          {scrolls && (
            <div className="hidden gap-1.5 md:flex">
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full"
                onClick={() => page(-1)}
                disabled={edges.start}
                aria-label={`Scroll ${title} back`}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full"
                onClick={() => page(1)}
                disabled={edges.end}
                aria-label={`Scroll ${title} forward`}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Native horizontal scroll with snap: touch swipes, trackpads and
          keyboard all work without a carousel library. */}
      <div
        ref={scroller}
        onScroll={measure}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((item) => (
          <div key={item.id} className={CARD}>
            <ProductCard item={item} />
          </div>
        ))}
      </div>
    </section>
  )
}
