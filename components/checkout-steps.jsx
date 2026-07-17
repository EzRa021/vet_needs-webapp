"use client"

import { Check } from "lucide-react"

const STEPS = ["Cart", "Shipping", "Review", "Payment"]

// Progress indicator for the checkout flow.
// current: 0=Cart, 1=Shipping, 2=Review, 3=Payment/Done
export default function CheckoutSteps({ current }) {
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "border-2 border-primary bg-primary/10 text-primary"
                        : "border-2 border-border bg-background text-muted-foreground"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={`text-xs font-medium sm:text-sm ${
                    active ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`mx-2 h-0.5 flex-1 rounded sm:mx-4 ${
                    i < current ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
