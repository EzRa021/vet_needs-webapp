"use client"

import { useState } from "react"
import { Plus, Minus, PackagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatQuantity } from "@/lib/units"
import { useAdjustStock } from "@/stores/adminStore"
import { cn } from "@/lib/utils"

// Reasons split by direction, because they aren't interchangeable: you don't
// "restock" a bag you threw away. A free-text-only box would give you 40 rows
// saying "adjustment" and no way to total up what spoilage actually cost.
const REASONS_IN = [
  { value: "restock", label: "Delivery from supplier" },
  { value: "return", label: "Customer return" },
  { value: "count_correction", label: "Stock count correction" },
  { value: "other", label: "Other" },
]

const REASONS_OUT = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired / spoiled" },
  { value: "offline_sale", label: "Sold offline / in person" },
  { value: "sample", label: "Sample or giveaway" },
  { value: "theft", label: "Loss / theft" },
  { value: "count_correction", label: "Stock count correction" },
  { value: "other", label: "Other" },
]

export default function StockAdjust({ product, trigger }) {
  const { toast } = useToast()
  const adjust = useAdjustStock()
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState("in")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")

  const reasons = direction === "in" ? REASONS_IN : REASONS_OUT
  const qty = Number(amount)
  const valid = Number.isFinite(qty) && qty > 0 && reason

  const current = Number(product?.stock ?? 0)
  const delta = direction === "in" ? qty : -qty
  const next = Number.isFinite(qty) ? current + delta : current

  const submit = () =>
    adjust.mutate(
      { itemId: product.id, delta, reason, note },
      {
        onSuccess: (newStock) => {
          toast({
            title: "Stock updated",
            description: `${product.name} is now ${formatQuantity(newStock, product.unit_type)}.`,
          })
          setOpen(false)
          setAmount("")
          setReason("")
          setNote("")
        },
        onError: (err) =>
          toast({
            title: "Couldn't adjust stock",
            description: err.message,
            variant: "destructive",
          }),
      }
    )

  // A product with stock = null doesn't track inventory; there's nothing to
  // adjust and adjust_stock() would refuse anyway.
  if (product?.stock === null || product?.stock === undefined) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <PackagePlus className="size-3.5" />
            Adjust stock
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product.name} — currently{" "}
            <strong>{formatQuantity(current, product.unit_type)}</strong>. This is
            recorded in the product&apos;s history with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Direction first: it's the thing that decides which reasons apply. */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "in", label: "Add", icon: Plus },
              { key: "out", label: "Remove", icon: Minus },
            ].map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setDirection(d.key)
                  setReason("")
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                  direction === d.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:border-primary/40"
                )}
              >
                <d.icon className="size-4" />
                {d.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-amount">
              Amount {product.unit_type === "kg" ? "(kg)" : "(units)"}
            </Label>
            <Input
              id="sa-amount"
              type="number"
              min="0"
              step={product.unit_type === "kg" ? "0.5" : "1"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {Number.isFinite(qty) && qty > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatQuantity(current, product.unit_type)} →{" "}
                <span className={cn("font-medium", next < 0 && "text-destructive")}>
                  {formatQuantity(next, product.unit_type)}
                </span>
                {next < 0 && " — that's below zero"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="sa-reason">
                <SelectValue placeholder="Why is it changing?" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-note">Note (optional)</Label>
            <Input
              id="sa-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Invoice number, who counted, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || next < 0 || adjust.isPending}>
            {adjust.isPending && <Spinner data-icon="inline-start" />}
            {direction === "in" ? "Add" : "Remove"}{" "}
            {Number.isFinite(qty) && qty > 0
              ? formatQuantity(qty, product.unit_type)
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
