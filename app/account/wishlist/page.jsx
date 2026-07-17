"use client"

import Link from "next/link"
import { Heart, AlertCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import BrandImage from "@/components/brand-image"
import ProductCard from "@/components/product-card"
import { useWishlist, useToggleWishlist } from "@/stores/wishlistStore"

// An item the shop has since switched off. It can't be bought, so rendering a
// normal ProductCard would show a working "add to cart" for something
// unpurchasable — say so plainly and offer the only action left: removing it.
function UnavailableCard({ row }) {
  const toggle = useToggleWishlist()
  const item = row.item

  return (
    <Card className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => toggle.mutate({ itemId: item.id, saved: true })}
        aria-label={`Remove ${item.name} from wishlist`}
        className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive"
      >
        <X className="size-4" />
      </button>
      <div className="relative aspect-square opacity-40 grayscale">
        <BrandImage
          src={item.image_url}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
          placeholderLabel={item.name}
        />
      </div>
      <CardContent className="p-4">
        <h3 className="line-clamp-1 font-semibold text-muted-foreground">{item.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">No longer available</p>
      </CardContent>
    </Card>
  )
}

export default function WishlistPage() {
  const { data: rows, isLoading, isError } = useWishlist()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-lg">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load your wishlist</AlertTitle>
        <AlertDescription>Please refresh the page or try again in a moment.</AlertDescription>
      </Alert>
    )
  }

  // A row whose item is missing shouldn't happen — the FK cascades on delete —
  // but rendering null would crash the card, so filter defensively.
  const saved = (rows || []).filter((row) => row.item)

  if (saved.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-20 text-center">
        <Heart className="mx-auto mb-4 size-12 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Nothing saved yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
          Tap the heart on any product to keep it here for later. Your wishlist is
          saved to your account, so it follows you across devices.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/shop">Browse products</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-5 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{saved.length}</span>{" "}
        {saved.length === 1 ? "item" : "items"} saved
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {saved.map((row) =>
          row.item.is_active ? (
            <ProductCard key={row.id} item={row.item} />
          ) : (
            <UnavailableCard key={row.id} row={row} />
          )
        )}
      </div>
    </div>
  )
}
