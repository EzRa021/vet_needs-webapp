"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import BrandImage from "@/components/brand-image"
import { usePromotion } from "@/stores/shopStore"

// How long a dismissal lasts. A popup you closed that returns on the next click
// isn't marketing, it's harassment — and it's the reason people install
// blockers. Two weeks is long enough that a "no" means something.
const SNOOZE_DAYS = 14
const KEY = "vetneeds-popup-dismissed"

// Long enough that it doesn't land on top of someone still reading the hero,
// short enough to catch them before they navigate away.
const DELAY_MS = 6000

function dismissedRecently(id) {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const seen = JSON.parse(raw)
    const at = seen[id]
    if (!at) return false
    return Date.now() - at < SNOOZE_DAYS * 86400_000
  } catch {
    // A corrupt/blocked localStorage must not mean "show it forever".
    return true
  }
}

function remember(id) {
  try {
    const raw = localStorage.getItem(KEY)
    const seen = raw ? JSON.parse(raw) : {}
    seen[id] = Date.now()
    localStorage.setItem(KEY, JSON.stringify(seen))
  } catch {
    /* private mode — the session state below still hides it for this visit */
  }
}

// The `popup` placement has been selectable in the admin since 000 with nothing
// rendering it — an admin could create one, see it listed as live, and it would
// never appear anywhere.
export default function PromoPopup() {
  const { promotion } = usePromotion("popup")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!promotion?.id) return
    if (dismissedRecently(promotion.id)) return

    const t = setTimeout(() => setOpen(true), DELAY_MS)
    return () => clearTimeout(t)
  }, [promotion?.id])

  // Escape closes, like any other overlay. Skipping this is how a popup becomes
  // a trap for keyboard users.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && close()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    if (promotion?.id) remember(promotion.id)
  }

  if (!open || !promotion) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-popup-title"
    >
      {/* Clicking away closes it — the same as saying no. */}
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={close}
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Close"
          // Real hit area, top-right, always visible. The tiny greyed-out ✕ is
          // a dark pattern, not a style.
          className="absolute right-2 top-2 z-10 size-9 rounded-full bg-card/80 backdrop-blur"
        >
          <X className="size-4" />
        </Button>

        {promotion.image_url && (
          <div className="relative aspect-[4/3] bg-surface-2">
            <BrandImage
              src={promotion.image_url}
              alt=""
              fill
              sizes="384px"
              className="object-cover"
            />
          </div>
        )}

        <div className="space-y-3 p-5 text-center">
          <h2 id="promo-popup-title" className="font-display text-xl font-bold">
            {promotion.title}
          </h2>
          {promotion.subtitle && (
            <p className="text-sm text-muted-foreground">{promotion.subtitle}</p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {promotion.link_url && (
              <Button asChild onClick={close}>
                <Link href={promotion.link_url}>Shop now</Link>
              </Button>
            )}
            {/* A real "no" button. "Close" as the only exit makes people hunt. */}
            <Button variant="ghost" size="sm" onClick={close}>
              No thanks
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
