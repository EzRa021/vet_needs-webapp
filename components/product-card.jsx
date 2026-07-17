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
import { formatNaira, formatUnitPrice } from "@/lib/pricing"

// Shared product card — used on home, shop grid, category and related sections
// so every product looks identical across the store.
export default function ProductCard({ item }) {
  const { toast } = useToast()
  const addToCart = useCartStore((state) => state.addItem)
  const [added, setAdded] = useState(false)

  const stock = Number(item.stock)
  const outOfStock = stock === 0 && !item.allow_backorder
  const lowStock = !outOfStock && stock > 0 && stock < (item.low_stock_threshold ?? 10)
  const hasDiscount = item.compare_at_price && Number(item.compare_at_price) > Number(item.price)
  const discountPercent = hasDiscount
    ? Math.round((1 - item.price / item.compare_at_price) * 100)
    : 0

  const handleAddToCart = (e) => {
    e.preventDefault()
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
    toast({
      title: "Added to cart",
      description: `${item.name} has been added to your cart.`,
    })
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover">
      <Link href={`/product/${item.id}`} className="block" aria-label={item.name}>
        <div className="relative aspect-square overflow-hidden bg-surface-2">
          <BrandImage
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            placeholderLabel={item.name}
          />

          {/* Badges */}
          <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
            {hasDiscount && (
              <Badge className="border-transparent bg-earth text-earth-foreground shadow-sm">
                -{discountPercent}%
              </Badge>
            )}
            {lowStock && (
              <Badge variant="destructive" className="shadow-sm">
                Only {stock}
                {item.unit_type === "kg" ? " kg" : ""} left
              </Badge>
            )}
            {outOfStock && (
              <Badge variant="secondary" className="shadow-sm">Out of Stock</Badge>
            )}
          </div>

          <WishlistButton
            itemId={item.id}
            itemName={item.name}
            revealOnHover
            className="absolute right-2.5 top-2.5 h-8 w-8 rounded-full bg-card/90 shadow-sm backdrop-blur"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {item.category?.name && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.category.name}
          </p>
        )}
        <Link href={`/product/${item.id}`}>
          <h3 className="line-clamp-1 font-semibold leading-snug transition-colors group-hover:text-primary">
            {item.name}
          </h3>
        </Link>

        {item.rating_count > 0 ? (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-earth text-earth" />
            <span className="font-medium">{Number(item.rating_avg).toFixed(1)}</span>
            <span className="text-muted-foreground">({item.rating_count})</span>
          </div>
        ) : (
          <div className="mt-1 h-[18px]" />
        )}

        {/* Price + quick add */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tabular-nums text-primary">
              {formatUnitPrice(item.price, item.unit_type)}
            </p>
            {hasDiscount && (
              <p className="text-xs tabular-nums text-muted-foreground line-through">
                {formatNaira(item.compare_at_price)}
              </p>
            )}
          </div>
          <Button
            size="icon"
            onClick={handleAddToCart}
            disabled={outOfStock}
            aria-label={`Add ${item.name} to cart`}
            className="h-10 w-10 shrink-0 rounded-full shadow-sm transition-transform active:scale-95"
          >
            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
