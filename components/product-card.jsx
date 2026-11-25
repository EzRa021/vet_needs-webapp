"use client"

import Link from "next/link"
import { Plus, Star, Check } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import BrandImage from "@/components/brand-image"
import WishlistButton from "@/components/wishlist-button"
import { useToast } from "@/hooks/use-toast"
import { useCartStore } from "@/stores/cartStore"
import { showAddedToCart } from "@/stores/cartDrawerStore"
import { formatNaira } from "@/lib/pricing"
import { cn } from "@/lib/utils"

// Add-to-cart shared by every place that sells one product in one tap (the
// card, the home page deal), so the cart always gets the same fields.
export function useQuickAdd(item) {
  const { toast } = useToast()
  const addToCart = useCartStore((state) => state.addItem)
  const [added, setAdded] = useState(false)
  const outOfStock = Number(item?.stock) === 0 && !item?.allow_backorder

  const add = (e) => {
    e?.preventDefault?.()
    if (!item || outOfStock) return
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url,
      quantity: 1,
      // Carried so the cart can cap quantity without a round-trip. Refreshed by
      // useCartSync() on the cart page — this copy goes stale like the rest.
      stock: item.stock,
      allow_backorder: item.allow_backorder,
      unit_type: item.unit_type,
      vat_enabled: item.vat_enabled,
      vat_rate: item.vat_rate,
      vat_inclusive: item.vat_inclusive,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
    // The cart drawer slides in and says it; a toast is only the fallback
    // for a page without the drawer.
    if (!showAddedToCart(item.id)) {
      toast({
        title: "Added to cart",
        description: `${item.name} has been added to your cart.`,
      })
    }
  }

  return { add, added, outOfStock }
}

// The one product card — home, shop grid, category pages, rails, lists — so a
// product looks the same everywhere in the store.
//
// Compact, marketplace-style (2026-11-25, client's brief): what it's for, what
// it is, the picture, then the price with a one-tap add. Packshots are shown
// whole (object-contain on white) — a cropped feed bag hides the brand and the
// size, which is what people are reading.
//
// layout="grid" (default) stacks; layout="row" puts the picture on the left,
// for best sellers and short lists where many products share little space.
export default function ProductCard({ item, layout = "grid", className = "" }) {
  const { add: handleAddToCart, added, outOfStock } = useQuickAdd(item)

  const stock = Number(item.stock)
  const lowStock = !outOfStock && stock > 0 && stock < (item.low_stock_threshold ?? 10)
  const hasDiscount = item.compare_at_price && Number(item.compare_at_price) > Number(item.price)
  const discountPercent = hasDiscount
    ? Math.round((1 - item.price / item.compare_at_price) * 100)
    : 0
  const href = `/product/${item.id}`

  const category = item.category?.name ? (
    <p className="truncate text-xs text-muted-foreground">{item.category.name}</p>
  ) : (
    // Same height either way, so titles line up across a row.
    <p className="h-4" aria-hidden="true" />
  )

  const title = (
    <Link href={href} className="focus-visible:outline-none">
      <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 transition-colors group-hover:text-primary">
        {item.name}
      </h3>
    </Link>
  )

  const priceRow = (
    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
      <div className="min-w-0">
        {hasDiscount && (
          <p className="text-xs tabular-nums text-muted-foreground line-through">
            {formatNaira(item.compare_at_price)}
          </p>
        )}
        {/* Unit on its own line: "₦2,800.00 / kg" didn't fit beside the add
            button on a phone and was cut to "₦2,800…". */}
        <p className="truncate font-display text-[0.9375rem] font-bold tabular-nums sm:text-lg">
          {formatNaira(item.price)}
          {item.unit_type === "kg" && (
            <span className="ml-1 font-sans text-xs font-medium text-muted-foreground">per kg</span>
          )}
        </p>
        {item.rating_count > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs">
            <Star className="size-3.5 fill-earth text-earth" aria-hidden="true" />
            <span className="font-medium tabular-nums">{Number(item.rating_avg).toFixed(1)}</span>
            <span className="tabular-nums text-muted-foreground">({item.rating_count})</span>
            <span className="sr-only">out of 5 stars</span>
          </p>
        )}
      </div>
      <Button
        size="icon"
        onClick={handleAddToCart}
        disabled={outOfStock}
        aria-label={outOfStock ? `${item.name} is out of stock` : `Add ${item.name} to cart`}
        className="size-11 shrink-0 rounded-full transition-transform active:scale-95 lg:size-10"
      >
        {added ? <Check /> : <Plus />}
      </Button>
    </div>
  )

  const badges = (
    <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
      {hasDiscount && (
        <Badge className="border-transparent bg-earth px-1.5 text-earth-foreground tabular-nums">
          -{discountPercent}%
        </Badge>
      )}
      {lowStock && (
        <Badge variant="destructive" className="px-1.5">
          Only {stock}
          {item.unit_type === "kg" ? " kg" : ""} left
        </Badge>
      )}
      {outOfStock && (
        <Badge variant="secondary" className="px-1.5">Out of stock</Badge>
      )}
    </div>
  )

  if (layout === "row") {
    return (
      <div
        className={cn(
          "group relative flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40",
          className
        )}
      >
        <Link
          href={href}
          aria-label={item.name}
          className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-white sm:size-28"
        >
          <BrandImage
            src={item.image_url}
            alt=""
            fill
            sizes="112px"
            className="object-contain p-1.5"
            placeholderLabel=""
          />
          {badges}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          {category}
          {title}
          {priceRow}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-card p-3 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-card-hover",
        className
      )}
    >
      {category}
      {title}

      <Link
        href={href}
        aria-label={item.name}
        className="relative mt-2 block aspect-square overflow-hidden rounded-lg bg-white"
      >
        <BrandImage
          src={item.image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
          className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
          placeholderLabel={item.name}
        />
        {badges}
      </Link>

      <WishlistButton
        itemId={item.id}
        itemName={item.name}
        revealOnHover
        className="absolute right-[1.125rem] top-[5.125rem] size-8 rounded-full bg-card/90 shadow-sm backdrop-blur"
      />

      {priceRow}
    </div>
  )
}
