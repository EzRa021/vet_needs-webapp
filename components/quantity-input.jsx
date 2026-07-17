"use client"

import { useEffect, useState } from "react"
import { Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  isKg,
  stepFor,
  minQuantityFor,
  snapToStep,
  roundQuantity,
} from "@/lib/units"

// Quantity stepper that knows kg from pieces: feed steps in 0.5 kg and can be
// typed (nobody wants to press + fourteen times for 7 kg); pieces step in whole
// units and stay read-only.
export default function QuantityInput({
  value,
  onChange,
  unitType,
  max = null,
  size = "md",
  disabled = false,
}) {
  const step = stepFor(unitType)
  const min = minQuantityFor(unitType)
  const kg = isKg(unitType)

  // Free-typing needs a local buffer: committing on every keystroke would
  // rewrite "1." to "1" and make the decimal point impossible to type.
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(roundQuantity(value))), [value])

  const commit = (raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      setDraft(String(value))
      return
    }
    let next = snapToStep(n, unitType)
    if (next < min) next = min
    if (max !== null && next > max) next = snapToStep(max, unitType)
    setDraft(String(next))
    onChange(next)
  }

  const nudge = (delta) => {
    const next = roundQuantity(Number(value) + delta)
    if (next < min) return
    if (max !== null && next > max) return
    onChange(next)
  }

  const btn = size === "sm" ? "h-8 w-8" : "h-11 w-11"

  return (
    <div className="flex items-center rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btn, "rounded-none")}
        onClick={() => nudge(-step)}
        disabled={disabled || value <= min}
      >
        <Minus className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        <span className="sr-only">Decrease quantity</span>
      </Button>

      {kg ? (
        <div className="flex items-center">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commit(e.target.value)
              }
            }}
            aria-label="Quantity in kilograms"
            className={cn(
              "border-0 bg-transparent text-center font-medium tabular-nums outline-none focus-visible:ring-0",
              size === "sm" ? "w-9 text-sm" : "w-12"
            )}
          />
          <span
            className={cn(
              "pr-1 text-muted-foreground",
              size === "sm" ? "text-sm" : "text-base"
            )}
          >
            kg
          </span>
        </div>
      ) : (
        <span
          className={cn(
            "text-center font-medium tabular-nums",
            size === "sm" ? "w-8 text-sm" : "w-12"
          )}
        >
          {value}
        </span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(btn, "rounded-none")}
        onClick={() => nudge(step)}
        disabled={disabled || (max !== null && value >= max)}
      >
        <Plus className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        <span className="sr-only">Increase quantity</span>
      </Button>
    </div>
  )
}
