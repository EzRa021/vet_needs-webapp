"use client"

import { useState } from "react"
import { RotateCcw, Clock, CheckCircle2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { useRequestRefund, useMyRefundRequest } from "@/stores/orderActions"
import { LEGAL } from "@/lib/legal"

// Reasons, not a free-text box alone: staff triage these, and "damaged" vs
// "wrong item" is the difference between a courier problem and a picking one.
const REASONS = [
  "Item arrived damaged",
  "Wrong item sent",
  "Item never arrived",
  "Not as described",
  "No longer needed",
  "Other",
]

// What the customer sees once they've asked. Deliberately does NOT say
// "refunded" until the money is actually back — the whole point of 016.
const STATE = {
  requested: {
    icon: Clock,
    title: "Refund requested",
    body: "We're reviewing it and will email you.",
    tone: "text-muted-foreground",
  },
  approved: {
    icon: Clock,
    title: "Refund on its way",
    body: "We've sent it to Paystack. It can take a few working days to reach your account.",
    tone: "text-primary",
  },
  processed: {
    icon: CheckCircle2,
    title: "Refunded",
    body: "The money has been returned to your original payment method.",
    tone: "text-success",
  },
  rejected: {
    icon: XCircle,
    title: "Refund declined",
    body: `We couldn't approve this one. Email ${LEGAL.supportEmail} if you'd like to talk it through.`,
    tone: "text-destructive",
  },
  failed: {
    icon: XCircle,
    title: "Refund didn't go through",
    body: `Something went wrong at the payment provider. Please contact ${LEGAL.supportEmail}.`,
    tone: "text-destructive",
  },
}

export default function RefundRequest({ order, guestToken }) {
  const { toast } = useToast()
  const request = useRequestRefund()
  const { data: existing, isLoading } = useMyRefundRequest(order.id)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")

  // You can't be refunded money you never paid — a pending order is cancelled
  // instead (009). Cancelled orders have nothing to return either.
  const refundable = !["pending", "canceled", "refunded"].includes(order.status)

  if (isLoading) return null

  if (existing) {
    const s = STATE[existing.status] || STATE.requested
    const Icon = s.icon
    return (
      <div className="flex items-start gap-3 rounded-xl border p-4">
        <Icon className={`mt-0.5 size-5 shrink-0 ${s.tone}`} />
        <div>
          <p className="text-sm font-medium">
            {s.title}
            {existing.status === "processed" && existing.refunded_amount
              ? ` — ${formatNaira(existing.refunded_amount)}`
              : ""}
          </p>
          <p className="text-sm text-muted-foreground">{s.body}</p>
        </div>
      </div>
    )
  }

  if (!refundable) return null

  const submit = () =>
    request.mutate(
      { orderId: order.id, reason, details, guestToken },
      {
        onSuccess: () => {
          toast({
            title: "Refund requested",
            description: "We'll review it and email you.",
          })
          setOpen(false)
        },
        onError: (err) =>
          toast({
            title: "Couldn't request a refund",
            description: err.message,
            variant: "destructive",
          }),
      }
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <RotateCcw className="size-3.5" />
          Request a refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
          <DialogDescription>
            Tell us what went wrong and we&apos;ll take a look. Nothing is charged
            or reversed until we&apos;ve reviewed it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rr-reason">What&apos;s the problem?</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="rr-reason">
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rr-details">Anything else? (optional)</Label>
            <Textarea
              id="rr-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="The more you tell us, the faster we can sort it out."
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Reminder: opened feed and perishables can only be refunded if they&apos;re
            faulty — see our{" "}
            <a href="/terms" className="text-primary hover:underline">
              terms
            </a>
            .
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!reason || request.isPending}>
            {request.isPending && <Spinner data-icon="inline-start" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
