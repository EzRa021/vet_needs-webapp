"use client"

import Link from "next/link"
import { ArrowRight, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import BrandImage from "@/components/brand-image"
import { usePromotion } from "@/stores/shopStore"
import { cn } from "@/lib/utils"

// Renders an admin-managed banner for a placement. Returns nothing when there
// is no live promotion, so pages can drop it in unconditionally.
export default function PromoBanner({ placement, className }) {
  const { promotion, isLoading } = usePromotion(placement)

  if (isLoading) {
    return <Skeleton className={cn("h-28 w-full rounded-2xl", className)} />
  }
  if (!promotion) return null

  const Wrapper = promotion.link_url ? Link : "div"
  const wrapperProps = promotion.link_url ? { href: promotion.link_url } : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "group relative flex items-center gap-5 overflow-hidden rounded-2xl border bg-primary p-5 text-primary-foreground md:p-6",
        promotion.link_url && "transition-shadow hover:shadow-xl",
        className
      )}
    >
      {/* Background artwork, if the admin set one */}
      {promotion.image_url && (
        <>
          <BrandImage
            src={promotion.image_url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
            placeholderLabel=""
            icon={Megaphone}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-primary/40" />
        </>
      )}

      <div className="relative flex flex-1 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold md:text-xl">{promotion.title}</h3>
          {promotion.subtitle && (
            <p className="mt-0.5 text-sm text-primary-foreground/85">{promotion.subtitle}</p>
          )}
        </div>
        {promotion.link_url && (
          <Button variant="secondary" size="sm" className="shrink-0 font-semibold" asChild={false}>
            Shop now
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </Wrapper>
  )
}
