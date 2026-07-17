"use client"

import { Info, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatNaira } from "@/lib/pricing"

// Explains what the cart quietly corrected. Without this the shopper would see
// a total that changed on its own, which reads as the shop being untrustworthy
// — the honest move is to say what moved and why, per line.
function describe(change) {
  switch (change.type) {
    case "price":
      return change.to > change.from
        ? `${change.name} went up from ${formatNaira(change.from)} to ${formatNaira(change.to)}.`
        : `${change.name} dropped from ${formatNaira(change.from)} to ${formatNaira(change.to)}.`
    case "quantity":
      return `Only ${change.to} of ${change.name} left — your quantity was reduced from ${change.from}.`
    case "out_of_stock":
      return `${change.name} has sold out.`
    case "inactive":
      return `${change.name} is no longer sold.`
    case "gone":
      return `${change.name} is no longer available.`
    default:
      return null
  }
}

export default function CartChangesNotice({ changes, onDismiss }) {
  if (!changes || changes.length === 0) return null

  return (
    <Alert className="relative mb-6">
      <Info className="size-4" />
      <AlertTitle>Your cart was updated</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          Some things changed while this was sitting in your cart. We&apos;ve
          updated it so the total below is what you&apos;ll actually pay.
        </p>
        <ul className="ml-4 list-disc space-y-1">
          {changes.map((change, i) => {
            const text = describe(change)
            return text ? <li key={`${change.id}-${i}`}>{text}</li> : null
          })}
        </ul>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 size-7"
      >
        <X className="size-4" />
      </Button>
    </Alert>
  )
}
