"use client"

import { useState } from "react"
import { Plus, Truck, TriangleAlert, Pencil, Trash2, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { formatNaira } from "@/lib/pricing"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import {
  useShippingZones,
  useSaveShippingZone,
  useDeleteShippingZone,
} from "@/stores/adminStore"
import { cn } from "@/lib/utils"

const EMPTY = {
  name: "",
  states: [],
  fee: "",
  free_over: "",
  delivery_estimate: "",
  is_active: true,
  sort_order: 0,
}

function ZoneDialog({ open, onOpenChange, zone }) {
  const { toast } = useToast()
  const save = useSaveShippingZone()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)

  // Reset on open rather than on every render, so typing isn't clobbered.
  const onOpenChangeWrapped = (next) => {
    if (next) {
      setError(null)
      setForm(
        zone
          ? {
              name: zone.name || "",
              states: zone.states || [],
              fee: zone.fee ?? "",
              free_over: zone.free_over ?? "",
              delivery_estimate: zone.delivery_estimate || "",
              is_active: zone.is_active,
              sort_order: zone.sort_order ?? 0,
            }
          : EMPTY
      )
    }
    onOpenChange(next)
  }

  const toggleState = (state) =>
    setForm((f) => ({
      ...f,
      states: f.states.includes(state)
        ? f.states.filter((s) => s !== state)
        : [...f.states, state],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) return setError("Give the zone a name.")
    if (form.fee === "" || Number(form.fee) < 0) return setError("Enter a delivery fee.")

    try {
      await save.mutateAsync({ id: zone?.id, ...form })
      toast({ title: zone ? "Zone updated" : "Zone created" })
      onOpenChangeWrapped(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const isCatchAll = form.states.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrapped}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{zone ? "Edit zone" : "New delivery zone"}</DialogTitle>
          <DialogDescription>
            Pick the states this rate covers. Leave every state unticked to make it
            the catch-all for anywhere you haven&apos;t priced yet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel htmlFor="z-name">Name</FieldLabel>
              <Input
                id="z-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Lagos mainland"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="z-fee">Delivery fee (₦)</FieldLabel>
                <Input
                  id="z-fee"
                  type="number"
                  min="0"
                  step="50"
                  value={form.fee}
                  onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="z-free">Free over (₦)</FieldLabel>
                <Input
                  id="z-free"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.free_over ?? ""}
                  placeholder="Never"
                  onChange={(e) => setForm((f) => ({ ...f, free_over: e.target.value }))}
                />
                <FieldDescription>Blank = never free here.</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="z-eta">Delivery estimate</FieldLabel>
              <Input
                id="z-eta"
                value={form.delivery_estimate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, delivery_estimate: e.target.value }))
                }
                placeholder="e.g. 2–3 working days"
              />
              <FieldDescription>
                Shown at checkout. Leave blank rather than promise a time you can&apos;t keep.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>
                States{" "}
                <span className="font-normal text-muted-foreground">
                  ({form.states.length || "catch-all"})
                </span>
              </FieldLabel>
              <div className="flex flex-wrap gap-1.5 rounded-lg border p-3">
                {NIGERIAN_STATES.map((s) => {
                  const on = form.states.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleState(s)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary/40"
                      )}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              {isCatchAll && (
                <FieldDescription>
                  No states ticked — this zone will price anywhere not covered by
                  another zone.
                </FieldDescription>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field orientation="horizontal">
                <FieldLabel htmlFor="z-order">Sort order</FieldLabel>
                <Input
                  id="z-order"
                  type="number"
                  className="w-20"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="z-active">Active</FieldLabel>
                <Switch
                  id="z-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChangeWrapped(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              {zone ? "Save changes" : "Create zone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminShippingPage() {
  const { toast } = useToast()
  const { data: zones, isLoading, isError } = useShippingZones()
  const del = useDeleteShippingZone()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (zone) => {
    setEditing(zone)
    setDialogOpen(true)
  }

  const covered = new Set((zones || []).filter((z) => z.is_active).flatMap((z) => z.states))
  const hasCatchAll = (zones || []).some((z) => z.is_active && z.states.length === 0)
  const uncovered = NIGERIAN_STATES.filter((s) => !covered.has(s))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Delivery zones</h1>
          <p className="text-sm text-muted-foreground">
            What you charge to deliver, by state. A zone with no states is the
            catch-all.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus data-icon="inline-start" />
          New zone
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load zones</AlertTitle>
          <AlertDescription>Run migration 014, then refresh.</AlertDescription>
        </Alert>
      )}

      {/* The failure mode that actually costs money: a state nobody priced and
          no catch-all to fall back on. Checkout would silently use the old flat
          settings fee, which is exactly the guessing this feature replaces. */}
      {!isLoading && !hasCatchAll && uncovered.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>{uncovered.length} states have no rate</AlertTitle>
          <AlertDescription>
            There&apos;s no catch-all zone, so orders to {uncovered.slice(0, 3).join(", ")}
            {uncovered.length > 3 && ` and ${uncovered.length - 3} more`} fall back to
            the flat fee in Settings. Add a zone with no states ticked to price them
            deliberately.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(zones || []).map((z) => (
            <Card key={z.id} className={cn(!z.is_active && "opacity-60")}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {z.states.length === 0 && <Globe className="size-4 text-muted-foreground" />}
                      {z.name}
                      {!z.is_active && <Badge variant="outline">Off</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {z.states.length === 0
                        ? "Catch-all — anywhere not priced by another zone"
                        : `${z.states.length} state${z.states.length === 1 ? "" : "s"}`}
                      {z.delivery_estimate ? ` · ${z.delivery_estimate}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(z)} aria-label={`Edit ${z.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(z)}
                      aria-label={`Delete ${z.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Truck className="size-4 text-primary" />
                  {formatNaira(z.fee)}
                </span>
                <span className="text-muted-foreground">
                  {z.free_over === null
                    ? "Never free"
                    : `Free over ${formatNaira(z.free_over)}`}
                </span>
                {z.states.length > 0 && (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {z.states.join(", ")}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ZoneDialog open={dialogOpen} onOpenChange={setDialogOpen} zone={editing} />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Orders already placed keep the fee they were charged — it&apos;s stored
              on the order. Only future quotes change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await del.mutateAsync(pendingDelete.id)
                  toast({ title: "Zone deleted" })
                } catch (err) {
                  toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
                }
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
