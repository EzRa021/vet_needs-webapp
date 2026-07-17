"use client"

import { useState } from "react"
import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
}

// Read-only star display. Not a button, not focusable — it's a value.
export function StarRating({ value = 0, size = "md", className }) {
  const rounded = Math.round(Number(value) || 0)

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${Number(value).toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(
            SIZES[size],
            star <= rounded ? "fill-earth text-earth" : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  )
}

// Interactive picker. A radio group rather than buttons: "1 to 5 stars" is a
// single choice, so keyboard users get arrow-key selection for free and screen
// readers announce it as one control with five options.
export function StarRatingInput({ value, onChange, name = "rating", disabled }) {
  const [hovered, setHovered] = useState(0)
  const shown = hovered || value || 0

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Your rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          onMouseEnter={() => !disabled && setHovered(star)}
          className={cn(
            "cursor-pointer rounded p-0.5 transition-transform",
            disabled && "cursor-not-allowed opacity-60",
            !disabled && "hover:scale-110",
            // The native input is visually hidden, so the focus ring has to be
            // drawn on the label instead or keyboard users see nothing.
            "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
          )}
        >
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            disabled={disabled}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <Star
            className={cn(
              "size-7 transition-colors",
              star <= shown ? "fill-earth text-earth" : "fill-muted text-muted-foreground/40"
            )}
          />
          <span className="sr-only">
            {star} {star === 1 ? "star" : "stars"}
          </span>
        </label>
      ))}
    </div>
  )
}
