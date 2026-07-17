"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, Minus, Plus, Package, Truck, ShieldCheck, AlertCircle } from "lucide-react"

import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import WishlistButton from "@/components/wishlist-button"
import ProductReviews from "@/components/product-reviews"
import QuantityInput from "@/components/quantity-input"
import ProductRail from "@/components/product-rail"
import NotifyMe from "@/components/notify-me"
import { StarRating } from "@/components/star-rating"
import { formatQuantity } from "@/lib/units"
import {
  useRecentlyViewed,
  useRecentlyViewedStore,
} from "@/stores/recentlyViewedStore"
import { useItem } from "@/stores/shopStore"
import { useCartStore } from "@/stores/cartStore"
import { formatNaira, formatUnitPrice, SHIPPING_FLAT } from "@/lib/pricing"

// Products from the same category (excluding the current one)
const useRelatedItems = (categoryId, excludeId) =>
  useQuery({
    queryKey: ["items", "related", categoryId, excludeId],
    enabled: !!categoryId,
    queryFn: async () => {
      const res = await fetch(`/api/shop/items?category=${categoryId}&limit=5`)
      if (!res.ok) throw new Error("Failed to load related products")
      const { data } = await res.json()
      return (data || []).filter((i) => i.id !== excludeId).slice(0, 4)
    },
    staleTime: 5 * 60 * 1000,
  })

// The interactive half of the product page. Split out of page.jsx so that file
// can be a server component and export generateMetadata — a crawler, and every
// link preview in WhatsApp, needs the title, description and image in the HTML,
// which a "use client" page cannot produce.
export default function ProductDetail() {
  const params = useParams()
  const { toast } = useToast()
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(null)

  const { data: item, isLoading, isError } = useItem(params.id)

  // Record the view only once the product actually loaded — recording on mount
  // would put 404s and typo'd URLs into "recently viewed".
  const record = useRecentlyViewedStore((s) => s.record)
  useEffect(() => {
    if (item?.id) record(item.id)
  }, [item?.id, record])

  const { items: recentlyViewed, isLoading: recentLoading } = useRecentlyViewed(params.id)
  const { data: related } = useRelatedItems(item?.category_id, item?.id)
  const addToCart = useCartStore((state) => state.addItem)
  const cartItem = useCartStore((state) =>
    state.items.find((i) => i.id === params.id)
  )

  const handleAddToCart = () => {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url,
      quantity,
      // Lets the cart cap quantity offline; refreshed by useCartSync().
      stock: item.stock,
      allow_backorder: item.allow_backorder,
      unit_type: item.unit_type,
      vat_enabled: item.vat_enabled,
      vat_rate: item.vat_rate,
      vat_inclusive: item.vat_inclusive,
    })
    toast({
      title: "Added to cart",
      description: `${formatQuantity(quantity, item.unit_type)} × ${item.name} added to your cart.`,
    })
  }

  if (isLoading) {
    return (
      <div className="container px-4 py-8 md:px-6 md:py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="container px-4 py-12 md:px-6">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Product not found</AlertTitle>
          <AlertDescription>
            This product may have been removed.{" "}
            <Link href="/shop" className="underline">Back to shop</Link>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const outOfStock = item.stock === 0 && !item.allow_backorder
  const lowStock = item.stock > 0 && item.stock < (item.low_stock_threshold ?? 10)
  const maxQty = item.stock > 0 ? item.stock : 99
  const hasDiscount = item.compare_at_price && item.compare_at_price > item.price
  const discountPercent = hasDiscount
    ? Math.round((1 - item.price / item.compare_at_price) * 100)
    : 0
  const gallery = (item.images || []).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="container px-4 py-8 md:px-6 md:py-12">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:text-primary">Shop</Link>
        {item.category?.name && (
          <>
            <span className="mx-2">/</span>
            <span>{item.category.name}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-foreground">{item.name}</span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {activeImage || item.image_url ? (
              <Image
                src={activeImage || item.image_url}
                alt={item.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No image available
              </div>
            )}
            {lowStock && (
              <Badge variant="destructive" className="absolute left-3 top-3">
                Only {item.stock} left
              </Badge>
            )}
            {outOfStock && (
              <Badge variant="secondary" className="absolute left-3 top-3">
                Out of Stock
              </Badge>
            )}
          </div>

          {/* Thumbnail gallery (main image + extra item_images) */}
          {gallery.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[{ url: item.image_url, alt_text: item.name }, ...gallery]
                .filter((img) => img.url)
                .map((img, i) => (
                  <button
                    key={img.url + i}
                    type="button"
                    onClick={() => setActiveImage(img.url)}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                      (activeImage || item.image_url) === img.url
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/40"
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt_text || item.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {item.category?.name && (
              <Badge variant="outline">{item.category.name}</Badge>
            )}
            {item.brand && <Badge variant="secondary">{item.brand}</Badge>}
            {hasDiscount && (
              <Badge variant="destructive">-{discountPercent}%</Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold">{item.name}</h1>

          {item.rating_count > 0 && (
            <a href="#reviews" className="group flex w-fit items-center gap-2 text-sm">
              <StarRating value={item.rating_avg} size="sm" />
              <span className="font-medium tabular-nums">
                {Number(item.rating_avg).toFixed(1)}
              </span>
              <span className="text-muted-foreground underline-offset-4 group-hover:underline">
                ({item.rating_count} review{item.rating_count === 1 ? "" : "s"})
              </span>
            </a>
          )}

          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold text-primary">
              {formatUnitPrice(item.price, item.unit_type)}
            </p>
            {hasDiscount && (
              <p className="text-lg text-muted-foreground line-through">
                {formatUnitPrice(item.compare_at_price, item.unit_type)}
              </p>
            )}
          </div>

          {item.vat_enabled && item.vat_inclusive && (
            <p className="text-xs text-muted-foreground">
              Price includes {Number(item.vat_rate ?? 7.5)}% VAT
            </p>
          )}

          {item.description && (
            <p className="text-muted-foreground leading-relaxed">{item.description}</p>
          )}

          {item.long_description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {item.long_description}
            </p>
          )}

          {item.attributes && Object.keys(item.attributes).length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border p-4 text-sm">
              {Object.entries(item.attributes).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="capitalize text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Quantity + Add to cart */}
          {!outOfStock && (
            <div className="flex items-center gap-4">
              <QuantityInput
                value={quantity}
                onChange={setQuantity}
                unitType={item.unit_type}
                max={maxQty}
              />
              <Button size="lg" className="flex-1" onClick={handleAddToCart}>
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart
              </Button>
            </div>
          )}

          {outOfStock && (
            <div className="space-y-3">
              <Button size="lg" disabled className="w-full">
                Out of Stock
              </Button>
              {/* The only useful thing left on this page. Wishlist saves it;
                  this tells them when they can actually have it. */}
              <NotifyMe item={item} />
            </div>
          )}

          {/* Save for later. Worth offering most when the item is out of stock —
              it's the only useful action left on the page. */}
          <WishlistButton
            itemId={item.id}
            itemName={item.name}
            showLabel
            className="h-11 w-full rounded-xl border md:w-auto md:px-5"
          />

          {cartItem && (
            <p className="text-sm text-muted-foreground">
              Already in cart: {cartItem.quantity} —{" "}
              <Link href="/cart" className="text-primary underline">view cart</Link>
            </p>
          )}

          <Separator />

          {/* Trust info */}
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <span>Flat shipping {formatNaira(SHIPPING_FLAT)} nationwide</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Secure payment via Paystack</span>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <span>{outOfStock ? "Currently out of stock" : `${item.stock ?? "In"} in stock`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews — above "you may also like": a shopper deciding on THIS
          product should hit the evidence before the exit links. */}
      <div className="mt-16 md:mt-20">
        <ProductReviews itemId={item.id} itemName={item.name} />
      </div>

      {/* Related products */}
      <ProductRail
        title="You may also like"
        items={related}
        className="mt-16 md:mt-20"
      />

      {/* Recently viewed — after "you may also like": what the shop suggests is
          more useful than what you already know you looked at. */}
      <ProductRail
        title="Recently viewed"
        items={recentlyViewed}
        isLoading={recentLoading}
        className="mt-16 md:mt-20"
      />


      {/* Sticky mobile add-to-cart bar */}
      {!outOfStock && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-base font-bold text-primary">
                {formatUnitPrice(item.price, item.unit_type)}
              </p>
            </div>
            <Button size="lg" className="shrink-0" onClick={handleAddToCart}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        </div>
      )}
      {/* Spacer so the sticky bar never covers page content on mobile */}
      <div className="h-20 md:hidden" />
    </div>
  )
}
