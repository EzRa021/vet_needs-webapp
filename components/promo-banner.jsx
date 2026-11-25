"use client"

import Link from "next/link"
import { ArrowRight, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import BrandImage from "@/components/brand-image"
import { usePromotion } from "@/stores/shopStore"
import { cn } from "@/lib/utils"

// Renders an admin-managed banner for a placement (home_banner, shop_banner).
// Returns nothing when there is no live promotion, so pages can drop it in
// unconditionally.
//
// The artwork is the point of a promotion, so it's shown WHOLE, beside the
// words — not as a faded backdrop behind them. It used to sit at 30% opacity
// under a blue gradient in a strip one line of text tall, which hid most of
// it ("Christmas sales" with a dog and cat you could barely see).
// object-contain keeps any shape of picture uncropped: a cut-out PNG floats
// on the brand blue, a photo sits in its own frame.
export default function PromoBanner({ placement, className = "" }) {
  const { promotion, isLoading } = usePromotion(placement)

  if (isLoading) {
    return <Skeleton className={cn("h-48 w-full rounded-2xl md:h-64", className)} />
  }
  if (!promotion) return null

  const Wrapper = promotion.link_url ? Link : "div"
  const wrapperProps = promotion.link_url ? { href: promotion.link_url } : {}
  const hasImage = Boolean(promotion.image_url)

  // Picture only (034): a finished banner with its words in it. Shown whole,
  // at its own shape, full width — nothing drawn over or beside it. The title
  // is what screen readers hear.
  if (promotion.image_only && hasImage) {
    return (
      <Wrapper
        {...wrapperProps}
        className={cn(
          "block overflow-hidden rounded-2xl border bg-card",
          promotion.link_url && "transition-shadow hover:shadow-xl",
          className
        )}
      >
        <BrandImage
          natural
          src={promotion.image_url}
          alt={promotion.title}
          sizes="(max-width: 1280px) 100vw, 1280px"
          icon={Megaphone}
        />
      </Wrapper>
    )
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "group relative grid overflow-hidden rounded-2xl border bg-primary text-primary-foreground",
        hasImage && "md:min-h-64 md:grid-cols-[minmax(0,1fr)_minmax(0,42%)]",
        promotion.link_url && "transition-shadow hover:shadow-xl",
        className
      )}
    >
      {/* Soft light behind the artwork so a cut-out has depth on the blue. */}
      {hasImage && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary-foreground/15 blur-3xl"
        />
      )}

      <div
        className={cn(
          "relative flex flex-col justify-center gap-3 p-6 md:p-8",
          !hasImage && "md:flex-row md:items-center md:justify-between md:p-6"
        )}
      >
        <div className="min-w-0">
          <h3 className={cn("font-display font-bold leading-tight", hasImage ? "text-2xl md:text-3xl" : "text-lg md:text-xl")}>
            {promotion.title}
          </h3>
          {promotion.subtitle && (
            <p className="mt-1.5 max-w-prose text-sm text-primary-foreground/85 md:text-base">
              {promotion.subtitle}
            </p>
          )}
        </div>
        {promotion.link_url && (
          // The whole banner is the link; this is its visible affordance, so
          // it's a span styled as a button rather than a second, nested link.
          <Button variant="secondary" size="sm" className="w-fit shrink-0 font-semibold" asChild>
            <span>
              Shop now
              <ArrowRight data-icon="inline-end" />
            </span>
          </Button>
        )}
      </div>

      {hasImage && (
        <div className="relative h-56 md:h-auto">
          <BrandImage
            src={promotion.image_url}
            alt={promotion.title}
            fill
            sizes="(max-width: 768px) 100vw, 42vw"
            className="object-contain p-3 drop-shadow-xl transition-transform duration-500 group-hover:scale-[1.03] md:p-4"
            placeholderLabel=""
            icon={Megaphone}
          />
        </div>
      )}
    </Wrapper>
  )
}
