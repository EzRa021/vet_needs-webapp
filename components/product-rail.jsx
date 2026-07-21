"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import ProductCard from "@/components/product-card"
import { RevealGroup, RevealItem } from "@/components/motion/reveal"
import { cn } from "@/lib/utils"

// A horizontal strip of products (best sellers, recently viewed, related).
//
// Renders NOTHING when empty rather than an empty state. A rail is a
// suggestion, not a promise — "You haven't viewed anything yet" is a box that
// takes up space to tell you something you already know. Same reasoning as the
// home page's reviews section.
export default function ProductRail({
  title,
  description,
  items,
  isLoading,
  href,
  hrefLabel = "See all",
  className,
  skeletonCount = 4,
}) {
  if (isLoading) {
    return (
      <section className={cn("space-y-4", className)}>
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {[...Array(skeletonCount)].map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </section>
    )
  }

  if (!items || items.length === 0) return null

  return (
    <section className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {href && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={href}>
              {hrefLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>

      <RevealGroup className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {items.slice(0, 4).map((item) => (
          <RevealItem key={item.id}>
            <ProductCard item={item} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}
