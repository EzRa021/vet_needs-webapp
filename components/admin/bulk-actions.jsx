"use client"

import { useState } from "react"
import { X, Eye, EyeOff, FolderInput, Percent, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { useBulkProducts, useAdminTaxonomy } from "@/stores/adminStore"

const NO_CATEGORY = "__none__"

function flatten(nodes, out = [], depth = 0) {
  for (const n of nodes || []) {
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) flatten(n.children, out, depth + 1)
  }
  return out
}

// Bulk price change. The one action here that can't be eyeballed afterwards —
// 200 products repriced by a mistyped number is not something you undo by
// remembering the old values. Hence the preview.
function PriceDialog({ open, onOpenChange, ids, selectedItems, onDone }) {
  const { toast } = useToast()
  const bulk = useBulkProducts()
  const [percent, setPercent] = useState("")

  const p = Number(percent)
  const valid = Number.isFinite(p) && p !== 0 && p >= -90 && p <= 500
  const factor = 1 + p / 100

  // Show real before/after on real products. An abstract "+10%" is easy to
  // agree to; "₦25,000 → ₦27,500" is where a wrong sign gets noticed.
  const preview = valid ? selectedItems.slice(0, 3) : []

  const apply = () =>
    bulk.mutate(
      { ids, action: "price", percent: p },
      {
        onSuccess: (d) => {
          toast({
            title: `${d.updated} ${d.updated === 1 ? "price" : "prices"} updated`,
            description: d.skipped ? `${d.skipped} skipped.` : "Each change is in the product's history.",
          })
          setPercent("")
          onOpenChange(false)
          onDone?.()
        },
        onError: (err) =>
          toast({ title: "Couldn't update prices", description: err.message, variant: "destructive" }),
      }
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change {ids.length} price{ids.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Each price moves by this percentage. There&apos;s no undo — but every change
            is logged in the product&apos;s history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pct">Adjust by (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pct"
                type="number"
                step="0.5"
                placeholder="e.g. 10 or -5"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
              <Percent className="size-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Positive raises, negative lowers. Between -90 and +500.
            </p>
          </div>

          {preview.length > 0 && (
            <div className="space-y-1.5 rounded-lg border p-3">
              <p className="text-xs font-medium">Preview</p>
              {preview.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted-foreground">{i.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatNaira(i.price)}{" "}
                    <span className="text-muted-foreground">→</span>{" "}
                    <span className={p > 0 ? "text-success" : "text-destructive"}>
                      {formatNaira(Math.round(Number(i.price) * factor * 100) / 100)}
                    </span>
                  </span>
                </div>
              ))}
              {ids.length > preview.length && (
                <p className="text-xs text-muted-foreground">
                  …and {ids.length - preview.length} more
                </p>
              )}
            </div>
          )}

          {percent !== "" && !valid && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                Enter a number between -90 and +500 (not zero).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!valid || bulk.isPending}>
            {bulk.isPending && <Spinner data-icon="inline-start" />}
            Apply to {ids.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BulkActions({ ids, selectedItems, onClear }) {
  const { toast } = useToast()
  const bulk = useBulkProducts()
  const { data: tree } = useAdminTaxonomy()
  const [priceOpen, setPriceOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTo, setMoveTo] = useState("")

  if (ids.length === 0) return null

  const run = (body, msg) =>
    bulk.mutate(body, {
      onSuccess: (d) => {
        toast({ title: msg(d.updated) })
        onClear()
      },
      onError: (err) =>
        toast({ title: "Bulk update failed", description: err.message, variant: "destructive" }),
    })

  const options = flatten(tree)

  return (
    <>
      {/* Sticky, because the selection is at the top of a long table and the
          actions are useless if you have to scroll back to find them. */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <span className="px-2 text-sm font-medium">
          {ids.length} selected
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={bulk.isPending}
          onClick={() => run({ ids, action: "activate" }, (n) => `${n} products shown in shop`)}
        >
          <Eye className="size-3.5" />
          Show
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={bulk.isPending}
          onClick={() => run({ ids, action: "deactivate" }, (n) => `${n} products hidden`)}
        >
          <EyeOff className="size-3.5" />
          Hide
        </Button>

        <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
          <FolderInput className="size-3.5" />
          Move
        </Button>

        <Button variant="outline" size="sm" onClick={() => setPriceOpen(true)}>
          <Percent className="size-3.5" />
          Change price
        </Button>

        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
          <X className="size-3.5" />
          Clear
        </Button>
      </div>

      <PriceDialog
        open={priceOpen}
        onOpenChange={setPriceOpen}
        ids={ids}
        selectedItems={selectedItems}
        onDone={onClear}
      />

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {ids.length} product{ids.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              They&apos;ll appear under the new category in the shop.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="move-to">Category</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-to">
                <SelectValue placeholder="Choose a category…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NO_CATEGORY}>— Uncategorised</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {" ".repeat(o.depth * 3)}
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!moveTo || bulk.isPending}
              onClick={() => {
                run(
                  {
                    ids,
                    action: "move",
                    category_id: moveTo === NO_CATEGORY ? null : moveTo,
                  },
                  (n) => `${n} products moved`
                )
                setMoveOpen(false)
                setMoveTo("")
              }}
            >
              {bulk.isPending && <Spinner data-icon="inline-start" />}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
