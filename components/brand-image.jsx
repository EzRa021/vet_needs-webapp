"use client"

import { useState } from "react"
import Image from "next/image"
import { PawPrint } from "lucide-react"

// Pictures next/image may resize: our own files and Supabase Storage (the
// hosts listed in next.config.js images.remotePatterns).
const SUPABASE_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null
  } catch {
    return null
  }
})()

function canOptimize(src) {
  if (typeof src !== "string") return true // static import
  if (src.startsWith("/")) return true
  try {
    const u = new URL(src)
    return Boolean(SUPABASE_HOST) && u.hostname === SUPABASE_HOST && u.pathname.startsWith("/storage/v1/object/public/")
  } catch {
    return false
  }
}

// next/image wrapper that falls back to a brand-colored (surface) placeholder
// when the source is missing or fails to load.
//
// A picture linked from another website (pasted into an image field) is shown
// as it is, not through the resizer: the resizer only accepts our own hosts,
// and refused everything else — the "Chrismas sales" banner showed a
// placeholder for exactly that reason. Uploading is still better (faster, and
// it can't vanish when the other site moves it).
//
// `natural`: full width at the picture's own shape (no cropping, no box) —
// for picture-only promotions, whose words are part of the picture.
export default function BrandImage({
  src,
  alt,
  fill = false,
  natural = false,
  width = undefined,
  height = undefined,
  sizes = undefined,
  priority = false,
  className = "",
  placeholderLabel = "",
  icon: Icon = PawPrint,
}) {
  const [failed, setFailed] = useState(false)
  const showPlaceholder = !src || failed

  if (showPlaceholder) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`img-placeholder flex flex-col items-center justify-center gap-2 text-primary/40 ${
          fill ? "absolute inset-0 h-full w-full" : ""
        } ${natural ? "aspect-[4/1] w-full" : ""} ${className}`}
        style={!fill && !natural && (width || height) ? { width, height } : undefined}
      >
        <Icon className="h-8 w-8" strokeWidth={1.5} />
        {placeholderLabel && (
          <span className="px-2 text-center text-xs font-medium text-muted-foreground">
            {placeholderLabel}
          </span>
        )}
      </div>
    )
  }

  if (natural) {
    return (
      <Image
        src={src}
        alt={alt}
        width={0}
        height={0}
        sizes={sizes || "100vw"}
        priority={priority}
        unoptimized={!canOptimize(src)}
        className={`h-auto w-full ${className}`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      unoptimized={!canOptimize(src)}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
