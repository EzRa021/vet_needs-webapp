"use client"

import { useState } from "react"
import { Ticket, X, Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCartStore } from "@/stores/cartStore"
import { useCheckoutStore } from "@/stores/checkoutStore"
import { useUser } from "@/stores/authStore"
import { formatNaira } from "@/lib/pricing"

// Discount code entry. The discount shown here is a preview returned by the
// server — create-order re-validates and recomputes it, so this can never be
// used to fake a cheaper order.
export default function CouponInput() {
  const items = useCartStore((s) => s.items)
  const coupon = useCheckoutStore((s) => s.coupon)
  const setCoupon = useCheckoutStore((s) => s.setCoupon)
  const clearCoupon = useCheckoutStore((s) => s.clearCoupon)
  const { data: user } = useUser()

  const [code, setCode] = useState("")
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const apply = async (e) => {
    e.preventDefault()
    setError(null)
    if (!code.trim()) return

    setChecking(true)
    try {
      const res = await fetch("/api/checkout/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.valid) {
        setError(json.error || "That code isn't valid.")
        return
      }
      setCoupon({ code: json.code, discount: json.discount })
      setCode("")
    } catch {
      setError("Couldn't check that code. Please try again.")
    } finally {
      setChecking(false)
    }
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Check className="size-4 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold tracking-wider">
              {coupon.code}
            </p>
            <p className="text-xs text-success">−{formatNaira(coupon.discount)} applied</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={clearCoupon}
          aria-label={`Remove discount code ${coupon.code}`}
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={apply} className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError(null)
            }}
            placeholder="Discount code"
            aria-label="Discount code"
            aria-invalid={error ? true : undefined}
            className="pl-9 font-mono uppercase tracking-wider"
          />
        </div>
        <Button type="submit" variant="outline" disabled={!code.trim() || checking}>
          {checking ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Apply
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!user && !error && (
        <p className="text-xs text-muted-foreground">Sign in to use a discount code.</p>
      )}
    </div>
  )
}
