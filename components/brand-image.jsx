"use client"

import { useState } from "react"
import Image from "next/image"
import { PawPrint } from "lucide-react"

// next/image wrapper that falls back to a brand-colored (#F5F7F2) placeholder
// when the source is missing or fails to load. Real generated images dropped
// into /public/images/ will slot in with no code changes.
export default function BrandImage({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  className = "",
  placeholderLabel,
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
        } ${className}`}
        style={!fill && (width || height) ? { width, height } : undefined}
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

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
