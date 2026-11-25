"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import BrandImage from "@/components/brand-image"
import { usePromotion } from "@/stores/shopStore"

// How long a closed popup stays away, set per popup in the admin (035):
//   visit  comes back on the next visit or refresh
//   day    once a day (the default, and what older popups get)
//   week   once a week
// It used to be a fixed 14 days, which read as "the popup doesn't work":
// close it once while checking it and it never came back in that browser.
const SNOOZE_MS = { visit: 0, day: 86_400_000, week: 7 * 86_400_000 }
// Old shop name kept on purpose: a new key would re-show the popup to everyone
// who already dismissed it.
const KEY = "vetneeds-popup-dismissed"

// Short: long enough for the page to settle, short enough that people see it
// before they've moved on (6 s missed anyone who refreshed or clicked away).
const DELAY_MS = 2000

// A popup is "the same" only while it says the same thing. Changing its
// picture, words or link makes it a new popup that everyone sees again.
const versionOf = (p) => [p.id, p.image_url, p.title, p.subtitle, p.link_url].join("|")

function dismissedRecently(promotion) {
  const snooze = SNOOZE_MS[promotion.popup_repeat] ?? SNOOZE_MS.day
  if (!snooze) return false
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const at = JSON.parse(raw)[versionOf(promotion)]
    return Boolean(at) && Date.now() - at < snooze
  } catch {
    // Storage blocked or corrupt: show it — the close button still works for
    // this page, and a popup that can never appear is the bug being fixed.
    return false
  }
}

function remember(promotion) {
  try {
    const raw = localStorage.getItem(KEY)
    const seen = raw ? JSON.parse(raw) : {}
    // Drop entries older than a week so the list can't grow forever.
    for (const [k, at] of Object.entries(seen)) {
      if (Date.now() - at > SNOOZE_MS.week) delete seen[k]
    }
    seen[versionOf(promotion)] = Date.now()
    localStorage.setItem(KEY, JSON.stringify(seen))
  } catch {
    /* private mode — closing still hides it for this page */
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
    if (dismissedRecently(promotion)) return

    const t = setTimeout(() => setOpen(true), DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotion?.id, promotion && versionOf(promotion)])

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
    if (promotion?.id) remember(promotion)
  }

  if (!open || !promotion) return null
  const picture = Boolean(promotion.image_only && promotion.image_url)

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

      <div
        className={
          picture
            ? "relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl"
            : "relative w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-xl"
        }
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Close"
          // Real hit area, top-right, always visible. The tiny greyed-out ✕ is
          // a dark pattern, not a style.
          className="absolute right-2 top-2 z-10 size-10 rounded-full bg-card/90 text-foreground shadow-md backdrop-blur hover:bg-card"
        >
          <X className="size-5" />
        </Button>

        {/* Picture only (034): the popup IS the picture — whole, larger, and
            itself the link. The × (and Escape, and clicking outside) close it. */}
        {picture ? (
          <>
            <h2 id="promo-popup-title" className="sr-only">{promotion.title}</h2>
            {promotion.link_url ? (
              <Link href={promotion.link_url} onClick={close} className="block">
                <BrandImage natural src={promotion.image_url} alt={promotion.title} sizes="(max-width: 480px) 100vw, 448px" priority />
              </Link>
            ) : (
              <BrandImage natural src={promotion.image_url} alt={promotion.title} sizes="(max-width: 480px) 100vw, 448px" priority />
            )}
          </>
        ) : (
        <>
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
        </>
        )}
      </div>
    </div>
  )
}
