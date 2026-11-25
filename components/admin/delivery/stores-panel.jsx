"use client"

import { useState } from "react"
import { MapPinned, Pencil, Plus, Store, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
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
import { formatNaira } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { useDeleteStore, useSaveStore } from "@/stores/deliveryAdminStore"

// Stores (029): where customers collect their orders. Each Ibadan area is
// assigned to one store (on the Areas tab), and a pickup order goes to the
// store of the customer's area.

function StoreForm({ store, onDone }) {
  const { toast } = useToast()
  const save = useSaveStore()
  const [form, setForm] = useState(() => ({
    name: store.name || "",
    address: store.address || "",
    phone: store.phone || "",
    hours: store.hours || "",
    map_url: store.map_url || "",
    instructions: store.instructions || "",
    fee: store.fee === undefined || store.fee === null ? "0" : String(Number(store.fee)),
    is_active: Boolean(store.is_active),
  }))
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) return setError("Give the store a name customers will recognise.")
    if (form.is_active && !form.address.trim()) return setError("Add the address before opening the store for pickup.")
    if (!(Number(form.fee) >= 0)) return setError("The pickup fee must be ₦0 or more.")
    if (form.map_url && !/^https:\/\//i.test(form.map_url.trim())) {
      return setError("The map link should start with https://. Copy it from the Share button in Google Maps.")
    }
    try {
      await save.mutateAsync({ id: store.id, ...form })
      toast({ title: store.id ? `${form.name.trim()} saved` : `${form.name.trim()} added` })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{store.id ? `Edit ${store.name}` : "New store"}</DialogTitle>
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
          <FieldLabel htmlFor="store-name">Name</FieldLabel>
          <Input id="store-name" value={form.name} onChange={set("name")} placeholder="e.g. VetNeeds Bodija" maxLength={80} />
        </Field>
        <Field>
          <FieldLabel htmlFor="store-address">Address</FieldLabel>
          <Textarea
            id="store-address"
            rows={2}
            value={form.address}
            onChange={set("address")}
            placeholder="Street and landmark"
          />
          <FieldDescription>In Ibadan, Oyo State.</FieldDescription>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="store-phone">Phone</FieldLabel>
            <Input id="store-phone" type="tel" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="store-hours">Opening hours</FieldLabel>
            <Input id="store-hours" value={form.hours} onChange={set("hours")} placeholder="e.g. Mon–Sat, 8am–6pm" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="store-map">Google Maps link (optional)</FieldLabel>
          <Input
            id="store-map"
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
          <FieldLabel htmlFor="store-instructions">Instructions (optional)</FieldLabel>
          <Input
            id="store-instructions"
            value={form.instructions}
            onChange={set("instructions")}
            placeholder="e.g. Ask at the front counter"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="store-fee">Pickup fee</FieldLabel>
          <InputGroup className="w-40">
            <InputGroupAddon>
              <InputGroupText>₦</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="store-fee"
              type="number"
              inputMode="decimal"
              min="0"
              step="50"
              value={form.fee}
              onChange={set("fee")}
              className="tabular-nums"
            />
          </InputGroup>
          <FieldDescription>0 makes pickup free.</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="store-active">Open for pickup</FieldLabel>
            <FieldDescription>Customers whose area is assigned here can collect from it.</FieldDescription>
          </FieldContent>
          <Switch id="store-active" checked={form.is_active} onCheckedChange={set("is_active")} />
        </Field>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner data-icon="inline-start" />}
          {store.id ? "Save store" : "Add store"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function StoresPanel({ data, onShowAreas }) {
  const { toast } = useToast()
  const del = useDeleteStore()
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const { stores, areas } = data

  const areasOf = (storeId) => areas.filter((a) => a.pickup_point_id === storeId)
  const newStore = () => setEditing({ is_active: true, fee: 0 })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Where customers collect their orders. Assign each area to its nearest store on the Areas tab.
        </p>
        <Button className="h-10" onClick={newStore}>
          <Plus data-icon="inline-start" />
          Add store
        </Button>
      </div>

      {stores.length === 0 ? (
        <Empty className="rounded-xl border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store />
            </EmptyMedia>
            <EmptyTitle>No stores yet</EmptyTitle>
            <EmptyDescription>Add your store so customers can collect their orders.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={newStore}>
              Add store
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stores.map((s) => {
            const served = areasOf(s.id)
            return (
              <Card key={s.id} className={cn(!s.is_active && "border-dashed")}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {s.name}
                      <Badge variant={s.is_active ? "default" : "outline"}>
                        {s.is_active ? "Open for pickup" : "Closed"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="tabular-nums">
                      {Number(s.fee) > 0 ? `${formatNaira(s.fee)} pickup fee` : "Free pickup"}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="size-10" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(s)}
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {s.address ? (
                    <PickupPointCard point={s} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No address yet.{" "}
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setEditing(s)}
                      >
                        Add the address
                      </button>
                    </p>
                  )}
                  <div className="flex items-start gap-2 text-sm">
                    <MapPinned className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {served.length ? (
                      <p>
                        <span className="font-medium tabular-nums">{served.length}</span>{" "}
                        {served.length === 1 ? "area" : "areas"}:{" "}
                        <span className="text-muted-foreground">
                          {served.slice(0, 8).map((a) => a.name).join(", ")}
                          {served.length > 8 ? ` and ${served.length - 8} more` : ""}
                        </span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        No areas assigned yet.{" "}
                        {onShowAreas && (
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            onClick={onShowAreas}
                          >
                            Assign areas
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {editing && <StoreForm store={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && areasOf(pendingDelete.id).length > 0
                ? `Its ${areasOf(pendingDelete.id).length} areas will have no store until you assign another. `
                : ""}
              Orders already placed for pickup here keep its details. To stop pickups for a while,
              close it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await del.mutateAsync(pendingDelete.id)
                  toast({ title: `${pendingDelete.name} deleted` })
                } catch (err) {
                  toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
                }
                setPendingDelete(null)
              }}
            >
              Delete store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
