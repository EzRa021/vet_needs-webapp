"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleCheck, Plus, Scale, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { bandLabel } from "@/lib/delivery"
import { useDeleteBand, useSaveBand } from "@/stores/deliveryAdminStore"

// Weight bands are shop-wide: every zone has one price per band. A band runs
// from the previous band's limit up to its own, so they can't overlap.
export default function BandsPanel({ data }) {
  const { toast } = useToast()
  const saveBand = useSaveBand()
  const deleteBand = useDeleteBand()
  const [newLimit, setNewLimit] = useState("")
  const [pendingDelete, setPendingDelete] = useState(null)
  const { bands, unweighed } = data
  const hasOpenBand = bands.some((b) => b.up_to_kg === null)

  const add = async (e) => {
    e.preventDefault()
    const kg = Number(newLimit)
    if (!(kg > 0)) {
      toast({ title: "Enter a weight above 0 kg", variant: "destructive" })
      return
    }
    try {
      await saveBand.mutateAsync({ up_to_kg: kg })
      setNewLimit("")
      toast({ title: `Band up to ${kg} kg added`, description: "Set its prices on the Prices tab." })
    } catch (err) {
      toast({ title: "Couldn't add band", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight bands</CardTitle>
          <CardDescription>
            Each zone has a price for every band. A heavier order moves to the next band, the way a
            rider switches from a bike to a tricycle to a van.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y rounded-lg border">
            {bands.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium tabular-nums">
                  <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
                  {bandLabel(b)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(b)}
                  aria-label={`Delete band ${bandLabel(b)}`}
                  disabled={bands.length <= 1}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>

          {!hasOpenBand && (
            <Alert>
              <TriangleAlert />
              <AlertDescription>
                There&apos;s no &ldquo;and above&rdquo; band, so orders heavier than the last band can&apos;t
                be priced online. Customers are asked to call or collect.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={add} className="flex flex-col gap-2">
            <Field>
              <FieldLabel htmlFor="band-limit">Add a band, up to</FieldLabel>
              <div className="flex gap-2">
                <div className="relative w-40">
                  <Input
                    id="band-limit"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="pr-10 tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    kg
                  </span>
                </div>
                <Button type="submit" variant="outline" disabled={saveBand.isPending || !newLimit}>
                  {saveBand.isPending ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                  Add band
                </Button>
              </div>
              <FieldDescription>
                e.g. 25 kg for one bag of feed. The band above it is split in two.
              </FieldDescription>
            </Field>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Products without a weight</CardTitle>
          <CardDescription>
            These count as weighing nothing, so an order of them can land in a cheaper band than it
            should. Items sold by the kg don&apos;t need one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unweighed.count === 0 ? (
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-4 text-success" aria-hidden="true" />
              Every product sold by the piece has a weight.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium tabular-nums">
                {unweighed.count} product{unweighed.count === 1 ? "" : "s"}
              </p>
              <ul className="flex flex-col divide-y rounded-lg border">
                {unweighed.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <Link
                      href={`/admin/products/${item.id}/edit`}
                      className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Add weight
                    </Link>
                  </li>
                ))}
              </ul>
              {unweighed.count > unweighed.items.length && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Showing {unweighed.items.length} of {unweighed.count}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the {pendingDelete ? bandLabel(pendingDelete) : ""} band?</AlertDialogTitle>
            <AlertDialogDescription>
              Every zone&apos;s price for this band is deleted too. Orders in this weight range move
              into the next band up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await deleteBand.mutateAsync(pendingDelete.id)
                  toast({ title: "Band deleted" })
                } catch (err) {
                  toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
                }
                setPendingDelete(null)
              }}
            >
              Delete band
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
