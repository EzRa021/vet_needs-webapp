"use client"

import { useState } from "react"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { cn } from "@/lib/utils"
import { useSaveZone } from "@/stores/deliveryAdminStore"

const blank = (v) => (v === null || v === undefined ? "" : String(v))

const initialForm = (zone) => ({
  name: zone.name || "",
  city: zone.city ?? null,
  states: zone.states || [],
  fee: blank(zone.fee),
  free_over: blank(zone.free_over),
  delivery_estimate: zone.delivery_estimate || "",
  is_active: zone.is_active ?? true,
  is_city_fallback: Boolean(zone.is_city_fallback),
  sort_order: zone.sort_order ?? 0,
})

// Create or edit a zone. `zone` = existing row, or a draft for a new one:
//   { city: "Ibadan" }  a new area zone for that city
//   { city: null }      a new state zone
//   { city: "" }        a new area zone for a city staff type in
//
// The form lives inside DialogContent, which unmounts on close, so every open
// starts from the zone as it is now.
export default function ZoneDialog({ open, onOpenChange, zone }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {zone && <ZoneForm zone={zone} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ZoneForm({ zone, onDone }) {
  const { toast } = useToast()
  const save = useSaveZone()
  const [form, setForm] = useState(() => initialForm(zone))
  const [error, setError] = useState(null)

  const isNew = !zone.id
  const isAreaZone = zone.city !== null && zone.city !== undefined

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))
  const toggleState = (s) =>
    setForm((f) => ({
      ...f,
      states: f.states.includes(s) ? f.states.filter((x) => x !== s) : [...f.states, s],
    }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) return setError("Give the zone a name.")
    if (isAreaZone && !String(form.city || "").trim()) return setError("Which city is this zone in?")
    for (const [key, label] of [["fee", "Price for any weight"], ["free_over", "Free over"]]) {
      if (form[key] !== "" && !(Number(form[key]) >= 0)) return setError(`${label} must be a number of zero or more.`)
    }
    try {
      await save.mutateAsync({ id: zone.id, ...form })
      toast({ title: isNew ? "Zone added" : "Zone saved" })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isNew ? "New zone" : `Edit ${zone.name}`}</DialogTitle>
          <DialogDescription>
            {isAreaZone
              ? "A group of areas that cost the same to deliver to. Set its prices per weight in the table."
              : "A delivery price for whole states. Leave every state unticked to price anywhere not covered elsewhere."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className={cn("grid gap-3", isAreaZone && "sm:grid-cols-2")}>
              <Field>
                <FieldLabel htmlFor="z-name">Name</FieldLabel>
                <Input
                  id="z-name"
                  value={form.name}
                  onChange={set("name")}
                  placeholder={isAreaZone ? "e.g. Ibadan Central" : "e.g. South West"}
                  autoFocus
                />
              </Field>
              {isAreaZone && (
                <Field>
                  <FieldLabel htmlFor="z-city">City</FieldLabel>
                  {/* A zone's city can't change once areas may be in it: the
                      database ties each area to a zone of its own city. */}
                  <Input
                    id="z-city"
                    value={form.city || ""}
                    onChange={set("city")}
                    disabled={!isNew || Boolean(zone.city)}
                    placeholder="e.g. Abeokuta"
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="z-free">Free delivery over (₦)</FieldLabel>
                <Input
                  id="z-free"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1000"
                  value={form.free_over}
                  onChange={set("free_over")}
                  placeholder="Never"
                  className="tabular-nums"
                />
                <FieldDescription>Blank = never free here. Applies to every weight.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="z-fee">Price for any weight (₦)</FieldLabel>
                <Input
                  id="z-fee"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="50"
                  value={form.fee}
                  onChange={set("fee")}
                  placeholder="Not used"
                  className="tabular-nums"
                />
                <FieldDescription>Only used while the zone has no prices per weight.</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="z-eta">Delivery time shown at checkout</FieldLabel>
              <Input
                id="z-eta"
                value={form.delivery_estimate}
                onChange={set("delivery_estimate")}
                placeholder="e.g. Same or next day"
              />
              <FieldDescription>Leave blank rather than promise a time you can&apos;t keep.</FieldDescription>
            </Field>

            {!isAreaZone && (
              <Field>
                <FieldLabel>
                  States{" "}
                  <span className="font-normal text-muted-foreground">
                    ({form.states.length || "anywhere not priced elsewhere"})
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
                          "min-h-8 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40"
                        )}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}

            {isAreaZone && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="z-fallback">Use for areas that aren&apos;t listed</FieldLabel>
                  <FieldDescription>
                    Customers who choose &ldquo;My area in {form.city || "this city"} isn&apos;t listed&rdquo;
                    pay this zone&apos;s price. One zone per city.
                  </FieldDescription>
                </FieldContent>
                <Switch id="z-fallback" checked={form.is_city_fallback} onCheckedChange={set("is_city_fallback")} />
              </Field>
            )}

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="z-active">Active</FieldLabel>
                <FieldDescription>Switched off, its areas aren&apos;t offered at checkout.</FieldDescription>
              </FieldContent>
              <Switch id="z-active" checked={form.is_active} onCheckedChange={set("is_active")} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              {isNew ? "Add zone" : "Save zone"}
            </Button>
          </DialogFooter>
        </form>
    </>
  )
}
