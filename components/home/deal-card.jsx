"use client"

import Link from "next/link"
import { Check, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import BrandImage from "@/components/brand-image"
import { useQuickAdd } from "@/components/product-card"
import { formatNaira, formatUnitPrice } from "@/lib/pricing"
import { cn } from "@/lib/utils"

// The product with the biggest real discount: today's price below its "was"
// price. Nothing qualifies → nothing renders (and the grid beside it widens).
export function pickDeal(items) {
  let best = null
  for (const item of items || []) {
    const was = Number(item.compare_at_price)
    const now = Number(item.price)
    if (!was || !(was > now)) continue
    if (Number(item.stock) === 0 && !item.allow_backorder) continue
    const pct = (was - now) / was
    if (!best || pct > best.pct) best = { item, pct }
  }
  return best
}

// One product, big, with what you save. The rubber-stamp seal is the
// storefront's signature (MASTER.md) — spent here, on the one thing worth it.
/** @param {{ deal?: any, className?: string }} props */
export default function DealCard({ deal = null, className = "" }) {
  const item = deal?.item
  const { add, added, outOfStock } = useQuickAdd(item)
  if (!item) return null

  const pct = Math.round(deal.pct * 100)
  const save = Number(item.compare_at_price) - Number(item.price)
  const href = `/product/${item.id}`

  return (
    <section
      aria-labelledby="deal-title"
      className={cn(
        "relative flex flex-col rounded-2xl border-2 border-earth/70 bg-card p-5",
        className
      )}
    >
      <h2 id="deal-title" className="font-display text-xl font-bold">
        Best deal
      </h2>

      <div className="stamp absolute -top-3 right-4 size-20 rotate-[-8deg] bg-card text-[10px] font-extrabold leading-tight tracking-[0.1em] shadow-md">
        <span>Save</span>
        <span className="font-display text-xl tracking-normal tabular-nums">{pct}%</span>
      </div>

      <Link href={href} className="group mt-3 flex flex-1 flex-col items-center gap-3">
        <div className="relative aspect-square w-full max-w-[190px] overflow-hidden rounded-xl bg-white sm:max-w-[260px]">
          <BrandImage
            src={item.image_url}
            alt=""
            fill
            sizes="260px"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            placeholderLabel={item.name}
          />
        </div>
        <h3 className="line-clamp-2 text-center font-semibold leading-snug transition-colors group-hover:text-primary">
          {item.name}
        </h3>
      </Link>

      <div className="mt-3 flex flex-col items-center gap-0.5">
        <p className="font-display text-3xl font-bold tabular-nums">
          {formatUnitPrice(item.price, item.unit_type)}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums line-through">{formatNaira(item.compare_at_price)}</span>
          {" · "}
          <span className="font-medium text-foreground">
            You save <span className="tabular-nums">{formatNaira(save)}</span>
          </span>
        </p>
      </div>

      <Button className="mt-4 h-11 w-full" onClick={add} disabled={outOfStock}>
        {added ? <Check data-icon="inline-start" /> : <ShoppingCart data-icon="inline-start" />}
        {added ? "Added to cart" : "Add to cart"}
      </Button>
    </section>
  )
}
