"use client"

import { useState } from "react"
import Link from "next/link"
import { RotateCcw, TriangleAlert, ExternalLink, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { useAdminRefunds, useReviewRefund } from "@/stores/adminStore"

const STATUS_META = {
  requested: { label: "Awaiting review", variant: "outline" },
  approved: { label: "Sent to Paystack", variant: "secondary" },
  processed: { label: "Refunded", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
}

const formatDate = (v) =>
  new Date(v).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

function ApproveDialog({ request, open, onOpenChange }) {
  const { toast } = useToast()
  const review = useReviewRefund()
  const [amount, setAmount] = useState("")
  const [restock, setRestock] = useState(false)
  const [notes, setNotes] = useState("")

  const total = Number(request?.order?.total_amount || 0)
  const value = amount === "" ? total : Number(amount)
  const isPartial = amount !== "" && value < total

  const submit = () =>
    review.mutate(
      {
        id: request.id,
        action: "approve",
        amount: amount === "" ? null : Number(amount),
        restock,
        admin_notes: notes,
      },
      {
        onSuccess: (res) => {
          toast({ title: "Refund submitted", description: res.message })
          onOpenChange(false)
        },
        onError: (err) =>
          toast({ title: "Refund failed", description: err.message, variant: "destructive" }),
      }
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund this order?</DialogTitle>
          <DialogDescription>
            This sends a real refund request to Paystack and moves money back to the
            customer. It can&apos;t be undone from here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="r-amount">Amount</Label>
            <Input
              id="r-amount"
              type="number"
              min="0"
              step="100"
              placeholder={`Full refund — ${formatNaira(total)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to refund the full {formatNaira(total)}.
              {isPartial && ` Partial refund of ${formatNaira(value)}.`}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox
              id="r-restock"
              checked={restock}
              onCheckedChange={(v) => setRestock(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="r-restock" className="text-sm font-normal">
                Put the items back into stock
              </Label>
              {/* Defaulted off deliberately — see 016. Feed returned because it
                  was mouldy must not go back on the shelf. */}
              <p className="text-xs text-muted-foreground">
                Only if the goods came back and can be sold again.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="r-notes">Note (optional)</Label>
            <Textarea
              id="r-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note / Paystack merchant note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={review.isPending}>
            {review.isPending && <Spinner data-icon="inline-start" />}
            Refund {formatNaira(value)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminRefundsPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState("requested")
  const { data, isLoading, isError } = useAdminRefunds(status)
  const review = useReviewRefund()
  const [approving, setApproving] = useState(null)

  const refunds = data?.data || []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Refunds</h1>
          <p className="text-sm text-muted-foreground">
            Approving sends a real refund through Paystack. An order only shows as
            refunded once the money has actually gone back.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="requested">Awaiting review</SelectItem>
            <SelectItem value="approved">Sent to Paystack</SelectItem>
            <SelectItem value="processed">Refunded</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load refunds</AlertTitle>
          <AlertDescription>Run migration 016, then refresh.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : refunds.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <RotateCcw className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <h2 className="font-semibold">Nothing here</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "requested"
              ? "No refund requests waiting."
              : "No refunds with this status."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {refunds.map((r) => {
            const meta = STATUS_META[r.status] || { label: r.status, variant: "secondary" }
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/orders/${r.order_id}`}
                        className="font-medium hover:text-primary"
                      >
                        Order #{r.order_id.slice(0, 8).toUpperCase()}
                      </Link>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {r.restock && <Badge variant="outline">Restocked</Badge>}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {r.email} · asked {formatDate(r.created_at)}
                      {r.paystack_refund_id && ` · Paystack #${r.paystack_refund_id}`}
                    </p>

                    <p className="text-sm">
                      <span className="font-medium">{r.reason}</span>
                      {r.details && (
                        <span className="text-muted-foreground"> — {r.details}</span>
                      )}
                    </p>

                    {r.admin_notes && (
                      <p className="text-xs text-muted-foreground">Note: {r.admin_notes}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatNaira(r.refunded_amount ?? r.requested_amount ?? r.order?.total_amount ?? 0)}
                    </span>

                    {r.status === "requested" && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => setApproving(r)}>
                          <Undo2 className="size-3.5" />
                          Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate(
                              { id: r.id, action: "reject" },
                              {
                                onSuccess: () => toast({ title: "Request rejected" }),
                                onError: (err) =>
                                  toast({
                                    title: "Couldn't reject",
                                    description: err.message,
                                    variant: "destructive",
                                  }),
                              }
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )}

                    {r.status === "approved" && (
                      <p className="max-w-[12rem] text-right text-xs text-muted-foreground">
                        Waiting for Paystack to settle. The order flips to refunded
                        automatically.
                      </p>
                    )}

                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/orders/${r.order_id}`}>
                        View order
                        <ExternalLink className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {approving && (
        <ApproveDialog
          request={approving}
          open={Boolean(approving)}
          onOpenChange={(o) => !o && setApproving(null)}
        />
      )}
    </div>
  )
}
