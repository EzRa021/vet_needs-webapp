"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, PawPrint } from "lucide-react"
import { useReducedMotion } from "framer-motion"

import { Button } from "@/components/ui/button"
import BrandImage from "@/components/brand-image"
import { cn } from "@/lib/utils"

// What shows when no "Home slider" promotion is live: the shop's own message.
const DEFAULT_SLIDE = {
  id: "default",
  title: "Good food for happy, healthy pets",
  subtitle:
    "Dry food, fresh-frozen meat by the kilo, supplements and everyday essentials, delivered across Ibadan or ready at the store.",
  image_url: "/images/hero-banner.png",
  link_url: "/shop",
  cta: "Shop pet food",
  alt: "A cat, five dogs and a rabbit — the pets Jvigor feeds and cares for",
}

const AUTOPLAY_MS = 7000

// The top of the home page: every live "Home slider" promotion as a slide, or
// the default message. Short on purpose (230 / 300 / 400 px) so products show
// on the first screen — the old hero filled it on its own.
//
// Native scroll-snap does the sliding, so swipe, trackpad and keyboard all
// work. Autoplay is gentle, pauses while hovered, focused or touched, stops for
// good once someone picks a slide, and never runs with reduced motion.
export default function HeroSlider({ promotions = null, className = "" }) {
  const slides = promotions?.length ? promotions : [DEFAULT_SLIDE]
  const track = useRef(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [stopped, setStopped] = useState(false)
  const reduce = useReducedMotion()
  const many = slides.length > 1

  const goTo = useCallback((i) => {
    const el = track.current
    if (!el) return
    const n = el.children.length
    const next = ((i % n) + n) % n
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" })
  }, [])

  const onScroll = () => {
    const el = track.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  useEffect(() => {
    if (!many || paused || stopped || reduce) return
    const t = setTimeout(() => goTo(index + 1), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [many, paused, stopped, reduce, index, goTo])

  const pick = (i) => {
    setStopped(true)
    goTo(i)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Offers"
      className={cn("relative overflow-hidden rounded-2xl border bg-surface-2 grain", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={() => setStopped(true)}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="flex h-[230px] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:h-[300px] lg:h-[400px] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className="grid w-full shrink-0 snap-start grid-cols-[1.25fr_1fr] items-center gap-2 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:px-16"
          >
            <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-4">
              <h2 className="line-clamp-3 font-display text-[1.375rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="line-clamp-2 max-w-[46ch] text-sm text-muted-foreground sm:line-clamp-3 sm:text-base">
                  {slide.subtitle}
                </p>
              )}
              <Button size="sm" className="mt-1 h-10 px-5 sm:h-11 sm:px-7 sm:text-base" asChild>
                <Link href={slide.link_url || "/shop"} tabIndex={i === index ? 0 : -1}>
                  {slide.cta || "Shop now"}
                </Link>
              </Button>
            </div>
            <div className="relative h-[82%] w-full">
              <BrandImage
                src={slide.image_url}
                alt={slide.alt || slide.title}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 45vw, 40vw"
                className="object-contain drop-shadow-xl"
                placeholderLabel=""
                icon={PawPrint}
              />
            </div>
          </div>
        ))}
      </div>

      {many && (
        <>
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/25"
                  )}
                />
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => pick(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 rounded-full bg-card/90 lg:inline-flex"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => pick(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 rounded-full bg-card/90 lg:inline-flex"
          >
            <ChevronRight />
          </Button>
        </>
      )}
    </section>
  )
}
