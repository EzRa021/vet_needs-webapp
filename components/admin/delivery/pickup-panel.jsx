"use client"

import { useState } from "react"
import { Pencil, Plus, Store, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import PickupPointCard from "@/components/pickup-point-card"
import { useToast } from "@/hooks/use-toast"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { formatNaira } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { useDeletePickupPoint, useSavePickupPoint } from "@/stores/deliveryAdminStore"

function PickupForm({ point, onDone }) {
  const { toast } = useToast()
  const save = useSavePickupPoint()
  const [form, setForm] = useState(() => ({
    name: point.name || "",
    address: point.address || "",
    city: point.city || "",
    state: point.state || "",
    phone: point.phone || "",
    hours: point.hours || "",
    map_url: point.map_url || "",
    instructions: point.instructions || "",
    fee: point.fee === undefined || point.fee === null ? "0" : String(point.fee),
    is_active: Boolean(point.is_active),
  }))
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) return setError("Give the pickup point a name customers will recognise.")
    if (!form.city.trim() || !form.state) return setError("Add the city and state.")
    if (form.is_active && !form.address.trim()) return setError("Add the address before switching pickup on.")
    if (!(Number(form.fee) >= 0)) return setError("The pickup fee must be ₦0 or more.")
    if (form.map_url && !/^https:\/\//i.test(form.map_url.trim())) {
      return setError("The map link should start with https://. Copy it from the Share button in Google Maps.")
    }
    try {
      await save.mutateAsync({ id: point.id, ...form })
      toast({ title: point.id ? "Pickup point saved" : "Pickup point added" })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{point.id ? `Edit ${point.name}` : "New pickup point"}</DialogTitle>
        <DialogDescription>Customers see these details at checkout and in their emails.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="mt-4">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="pp-name">Name</FieldLabel>
          <Input id="pp-name" value={form.name} onChange={set("name")} placeholder="e.g. VetNeeds Ibadan store" />
        </Field>
        <Field>
          <FieldLabel htmlFor="pp-address">Address</FieldLabel>
          <Textarea
            id="pp-address"
            rows={2}
            value={form.address}
            onChange={set("address")}
            placeholder="Street, landmark"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pp-city">City</FieldLabel>
            <Input id="pp-city" value={form.city} onChange={set("city")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pp-state">State</FieldLabel>
            <Select value={form.state} onValueChange={set("state")}>
              <SelectTrigger id="pp-state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pp-phone">Phone</FieldLabel>
            <Input id="pp-phone" type="tel" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pp-hours">Opening hours</FieldLabel>
            <Input id="pp-hours" value={form.hours} onChange={set("hours")} placeholder="e.g. Mon–Sat, 8am–6pm" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pp-map">Google Maps link (optional)</FieldLabel>
          <Input
            id="pp-map"
            type="url"
            value={form.map_url}
            onChange={set("map_url")}
            placeholder="https://maps.app.goo.gl/…"
          />
          <FieldDescription>
            In Google Maps, find the store, tap Share and copy the link. Without one, customers get
            a map search for the address.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="pp-instructions">Instructions (optional)</FieldLabel>
          <Input
            id="pp-instructions"
            value={form.instructions}
            onChange={set("instructions")}
            placeholder="e.g. Ask at the feed counter"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pp-fee">Pickup fee (₦)</FieldLabel>
          <Input
            id="pp-fee"
            type="number"
            inputMode="decimal"
            min="0"
            step="50"
            value={form.fee}
            onChange={set("fee")}
            className="w-40 tabular-nums"
          />
          <FieldDescription>0 makes pickup free. Free-delivery offers don&apos;t apply to this fee.</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="pp-active">Offer pickup here</FieldLabel>
            <FieldDescription>Customers can choose it at checkout.</FieldDescription>
          </FieldContent>
          <Switch id="pp-active" checked={form.is_active} onCheckedChange={set("is_active")} />
        </Field>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner data-icon="inline-start" />}
          {point.id ? "Save pickup point" : "Add pickup point"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function PickupPanel({ data }) {
  const { toast } = useToast()
  const del = useDeletePickupPoint()
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const points = data.pickupPoints
  const anyActive = points.some((p) => p.is_active)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Where customers can collect their order instead of paying for delivery.
        </p>
        <Button size="sm" onClick={() => setEditing({ is_active: false, fee: 0 })}>
          <Plus data-icon="inline-start" />
          Add pickup point
        </Button>
      </div>

      {points.length > 0 && !anyActive && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Pickup is off</AlertTitle>
          <AlertDescription>
            Customers only see &ldquo;Collect from our store&rdquo; once a pickup point is switched on. Add
            the store&apos;s address first.
          </AlertDescription>
        </Alert>
      )}

      {points.length === 0 ? (
        <Empty className="rounded-xl border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store />
            </EmptyMedia>
            <EmptyTitle>No pickup points</EmptyTitle>
            <EmptyDescription>Add your store so customers can collect their orders.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setEditing({ is_active: false, fee: 0 })}>
              Add pickup point
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {points.map((p) => (
            <Card key={p.id} className={cn(!p.is_active && "border-dashed")}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {p.name}
                    <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "On" : "Off"}</Badge>
                  </CardTitle>
                  <CardDescription className="tabular-nums">
                    {Number(p.fee) > 0 ? `${formatNaira(p.fee)} pickup fee` : "Free pickup"}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(p)}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {p.address ? (
                  <PickupPointCard point={p} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No address yet.{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setEditing(p)}
                    >
                      Add the address
                    </button>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {editing && <PickupForm point={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Orders already placed for pickup here keep its details. To stop offering it for a
              while, switch it off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await del.mutateAsync(pendingDelete.id)
                  toast({ title: "Pickup point deleted" })
                } catch (err) {
                  toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
                }
                setPendingDelete(null)
              }}
            >
              Delete pickup point
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
