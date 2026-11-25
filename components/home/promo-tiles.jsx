"use client"

import Link from "next/link"
import { ArrowRight, PawPrint } from "lucide-react"

import BrandImage from "@/components/brand-image"
import { cn } from "@/lib/utils"

// Three small tiles under the slider: a picture, a short line, "Shop now".
//
// Staff set them in Admin → Promotions as "Home tile" (033). Until they do —
// or for any of the three left empty — the shop's categories fill in, so the
// row is never blank and never advertises something that isn't sold.
export default function PromoTiles({ promotions = null, taxonomy = null, className = "" }) {
  const fromPromotions = (promotions || [])
    .filter((p) => p.image_url)
    .map((p) => ({
      id: p.id,
      title: p.title,
      text: p.subtitle,
      image: p.image_url,
      href: p.link_url || "/shop",
    }))

  const categories = (taxonomy || [])
    .flatMap((d) => (d.children?.length ? d.children : [d]))
    .map((c) => ({
      id: c.id,
      title: c.name,
      text: c.description,
      image: c.image_url,
      href: `/shop/category/${c.id}`,
    }))

  const tiles = [...fromPromotions, ...categories].slice(0, 3)
  if (tiles.length === 0) return null

  return (
    <ul
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {tiles.map((t) => (
        <li key={t.id} className="w-[85%] shrink-0 snap-start md:w-auto">
          <Link
            href={t.href}
            className="group flex h-full items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:size-24">
              <BrandImage
                src={t.image}
                alt=""
                fill
                sizes="96px"
                className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                placeholderLabel=""
                icon={PawPrint}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="line-clamp-2 font-display text-base font-bold leading-snug">{t.title}</p>
              {t.text && (
                <p className="line-clamp-1 text-sm text-muted-foreground">{t.text}</p>
              )}
              <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Shop now
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
