"use client"

import { useMemo, useState } from "react"
import { MapPinned, Pencil, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  toFee,
  useAddAreas,
  useDeleteArea,
  useSaveArea,
  useUpdateAreas,
} from "@/stores/deliveryAdminStore"

// Areas (029): every Ibadan area customers can choose at checkout, with
//   * its door-delivery price — blank means no door delivery there, so its
//     customers collect instead
//   * the store its customers collect from — the nearest one
// Both are edited right in the row, or for many areas at once.

const NONE = "__none"
const lower = (s) => String(s || "").toLowerCase()

const FILTERS = [
  { value: "all", label: "All areas" },
  { value: "no-price", label: "No delivery price" },
  { value: "no-store", label: "No pickup store" },
  { value: "hidden", label: "Hidden from checkout" },
]

// ₦ amount box, controlled — for forms that save with a button.
function MoneyInput({ id, value, onChange, label, className, ...props }) {
  return (
    <InputGroup className={cn("h-10", className)}>
      <InputGroupAddon>
        <InputGroupText>₦</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="50"
        placeholder="No delivery"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
        {...props}
      />
    </InputGroup>
  )
}

// ₦ amount box in an area's row. Saves when the field loses focus or on
// Enter; Escape puts the saved price back. Blank saves "no door delivery".
function PriceInput({ id, value, onSave, label, className }) {
  const saved = value === null || value === undefined ? "" : String(value)
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)

  const commit = async () => {
    const next = draft.trim()
    if (next === saved) return
    if (Number.isNaN(toFee(next))) {
      setDraft(saved)
      return
    }
    setBusy(true)
    const ok = await onSave(next)
    setBusy(false)
    if (!ok) setDraft(saved)
  }

  return (
    <InputGroup className={cn("h-10", className)}>
      <InputGroupAddon>
        <InputGroupText>₦</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="50"
        placeholder="No delivery"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            setDraft(saved)
          }
        }}
        className="tabular-nums"
      />
      {busy && (
        <InputGroupAddon align="inline-end">
          <Spinner aria-label="Saving" />
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

function StoreSelect({ id, value, stores, onChange, label, className }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger id={id} aria-label={label} className={cn("h-10", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No store yet</SelectItem>
        {stores.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
            {!s.is_active ? " (closed)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------- Add areas ----------
function AddAreasForm({ areas, stores, onDone }) {
  const { toast } = useToast()
  const add = useAddAreas()
  const [names, setNames] = useState("")
  const [fee, setFee] = useState("")
  const [storeId, setStoreId] = useState(null)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const list = names.split(/\r?\n/).map((n) => n.trim()).filter(Boolean)
    if (!list.length) return setError("Type at least one area name.")
    if (Number.isNaN(toFee(fee))) return setError("The delivery price must be ₦0 or more.")
    try {
      const { added, skipped } = await add.mutateAsync({
        names: list,
        delivery_fee: fee,
        pickup_point_id: storeId,
        existing: areas.map((a) => a.name),
      })
      toast({
        title: added === 1 ? "1 area added" : `${added} areas added`,
        description: skipped ? `${skipped} already in the list, so skipped.` : undefined,
      })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Add areas</DialogTitle>
        <DialogDescription>Ibadan areas customers can choose at checkout.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="mt-4">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="new-areas">Area names</FieldLabel>
          <Textarea
            id="new-areas"
            rows={5}
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={"One per line, e.g.\nAkobo\nIdi-Ape"}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="new-areas-fee">Door delivery price</FieldLabel>
            <MoneyInput id="new-areas-fee" value={fee} onChange={setFee} label="Door delivery price" />
            <FieldDescription>Leave blank for pickup only.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="new-areas-store">Pickup store</FieldLabel>
            <StoreSelect id="new-areas-store" value={storeId} stores={stores} onChange={setStoreId} label="Pickup store" />
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending && <Spinner data-icon="inline-start" />}
          Add areas
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------- Rename / other names ----------
function EditAreaForm({ area, onDone }) {
  const { toast } = useToast()
  const save = useSaveArea()
  const [name, setName] = useState(area.name)
  const [aliases, setAliases] = useState((area.aliases || []).join(", "))
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError("The area needs a name.")
    try {
      await save.mutateAsync({ id: area.id, name, aliases: aliases.split(",") })
      toast({ title: `${name.trim()} saved` })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Edit {area.name}</DialogTitle>
        <DialogDescription>The name customers search for at checkout.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="mt-4">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="area-name">Name</FieldLabel>
          <Input id="area-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field>
          <FieldLabel htmlFor="area-aliases">Other names (optional)</FieldLabel>
          <Input
            id="area-aliases"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="e.g. UI, U.I."
          />
          <FieldDescription>
            Separate with commas. Customers typing these find this area too.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner data-icon="inline-start" />}
          Save area
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------- Many at once ----------
function BulkBar({ count, stores, onApply, onClear, busy }) {
  const [fee, setFee] = useState("")
  const [storeId, setStoreId] = useState(null)

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3 p-4">
        <p className="w-full text-sm font-medium sm:w-auto sm:self-center">
          <span className="tabular-nums">{count}</span> {count === 1 ? "area" : "areas"} selected
        </p>
        <div className="flex items-end gap-2">
          <Field className="w-36">
            <FieldLabel htmlFor="bulk-fee" className="text-xs">Delivery price</FieldLabel>
            <MoneyInput id="bulk-fee" value={fee} onChange={setFee} label="Delivery price for selected areas" />
          </Field>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={busy}
            onClick={() => onApply({ delivery_fee: fee.trim() }, fee.trim() === "" ? "Delivery removed" : "Price set")}
          >
            Set price
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Field className="w-48">
            <FieldLabel htmlFor="bulk-store" className="text-xs">Pickup store</FieldLabel>
            <StoreSelect id="bulk-store" value={storeId} stores={stores} onChange={setStoreId} label="Pickup store for selected areas" />
          </Field>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={busy}
            onClick={() => onApply({ pickup_point_id: storeId }, storeId ? "Store set" : "Store removed")}
          >
            Set store
          </Button>
        </div>
        <Button type="button" variant="ghost" className="h-10 sm:ml-auto" onClick={onClear}>
          <X data-icon="inline-start" />
          Clear selection
        </Button>
      </CardContent>
    </Card>
  )
}

export default function AreasPanel({ data }) {
  const { toast } = useToast()
  const save = useSaveArea()
  const update = useUpdateAreas()
  const del = useDeleteArea()
  const { areas, stores } = data

  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState(() => new Set())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const counts = useMemo(
    () => ({
      all: areas.length,
      "no-price": areas.filter((a) => a.delivery_fee === null).length,
      "no-store": areas.filter((a) => !a.pickup_point_id).length,
      hidden: areas.filter((a) => !a.is_active).length,
    }),
    [areas]
  )

  const shown = useMemo(() => {
    const q = lower(query.trim())
    return areas.filter((a) => {
      if (filter === "no-price" && a.delivery_fee !== null) return false
      if (filter === "no-store" && a.pickup_point_id) return false
      if (filter === "hidden" && a.is_active) return false
      if (!q) return true
      return lower(a.name).includes(q) || (a.aliases || []).some((x) => lower(x).includes(q))
    })
  }, [areas, query, filter])

  const allShownSelected = shown.length > 0 && shown.every((a) => selected.has(a.id))
  const toggleAll = (on) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const a of shown) on ? next.add(a.id) : next.delete(a.id)
      return next
    })
  const toggleOne = (id, on) =>
    setSelected((prev) => {
      const next = new Set(prev)
      on ? next.add(id) : next.delete(id)
      return next
    })

  // One field of one area. Resolves true/false so the price box knows
  // whether to keep what was typed.
  const saveField = async (area, patch, success) => {
    try {
      await save.mutateAsync({ id: area.id, ...patch })
      if (success) toast({ title: success })
      return true
    } catch (err) {
      toast({ title: `Couldn't save ${area.name}`, description: err.message, variant: "destructive" })
      return false
    }
  }

  const applyBulk = async (patch, title) => {
    const ids = [...selected]
    try {
      await update.mutateAsync({ ids, patch })
      toast({ title: `${title} for ${ids.length} ${ids.length === 1 ? "area" : "areas"}` })
      setSelected(new Set())
    } catch (err) {
      toast({ title: "Couldn't update the areas", description: err.message, variant: "destructive" })
    }
  }

  const storeName = (id) => stores.find((s) => s.id === id)?.name

  if (areas.length === 0) {
    return (
      <>
        <Empty className="rounded-xl border py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinned />
            </EmptyMedia>
            <EmptyTitle>No areas yet</EmptyTitle>
            <EmptyDescription>Add the Ibadan areas you deliver to or serve from a store.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" />
              Add areas
            </Button>
          </EmptyContent>
        </Empty>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent className="sm:max-w-lg">
            {adding && <AddAreasForm areas={areas} stores={stores} onDone={() => setAdding(false)} />}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search areas"
            aria-label="Search areas"
            className="h-10 pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Show">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label} ({counts[f.value]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="h-10 sm:ml-auto" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add areas
        </Button>
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          stores={stores}
          busy={update.isPending}
          onApply={applyBulk}
          onClear={() => setSelected(new Set())}
        />
      )}

      <Card className="overflow-hidden">
        {/* Column heads, wide screens only; on a phone each row labels its
            own fields. */}
        <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_10rem_13rem_5.5rem_5.5rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <Checkbox checked={allShownSelected} onCheckedChange={toggleAll} aria-label="Select all shown areas" />
          <span>Area</span>
          <span>Door delivery</span>
          <span>Pickup store</span>
          <span>At checkout</span>
          <span className="sr-only">Actions</span>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="font-medium">No areas match</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              Show all areas
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {shown.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[2.5rem_minmax(0,1fr)_10rem_13rem_5.5rem_5.5rem]",
                  selected.has(a.id) && "bg-primary/5",
                  !a.is_active && "text-muted-foreground"
                )}
              >
                <Checkbox
                  checked={selected.has(a.id)}
                  onCheckedChange={(on) => toggleOne(a.id, on)}
                  aria-label={`Select ${a.name}`}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">{a.name}</span>
                  {a.aliases?.length > 0 && (
                    <span className="truncate text-xs text-muted-foreground">Also: {a.aliases.join(", ")}</span>
                  )}
                </div>

                {/* Actions sit top-right on a phone, last on wide screens. */}
                <div className="flex justify-end gap-1 md:order-last">
                  <Button variant="ghost" size="icon" className="size-10" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 text-destructive hover:text-destructive"
                    onClick={() => setPendingDelete(a)}
                    aria-label={`Delete ${a.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>

                <div className="col-span-3 grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-[10rem_13rem] md:gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground md:sr-only">Door delivery</span>
                    <PriceInput
                      key={`${a.id}:${a.delivery_fee}`}
                      id={`fee-${a.id}`}
                      value={a.delivery_fee}
                      label={`Door delivery price for ${a.name}`}
                      onSave={(v) => saveField(a, { delivery_fee: v })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground md:sr-only">Pickup store</span>
                    <StoreSelect
                      id={`store-${a.id}`}
                      value={a.pickup_point_id}
                      stores={stores}
                      label={`Pickup store for ${a.name}`}
                      onChange={(v) =>
                        saveField(a, { pickup_point_id: v }, v ? `${a.name} → ${storeName(v)}` : `${a.name} has no store now`)
                      }
                    />
                  </div>
                </div>

                <label className="col-span-3 flex items-center gap-2 text-sm md:col-span-1">
                  <Switch
                    checked={a.is_active}
                    onCheckedChange={(on) => saveField(a, { is_active: on }, on ? `${a.name} is shown` : `${a.name} is hidden`)}
                    aria-label={`Show ${a.name} at checkout`}
                  />
                  <span>{a.is_active ? "Shown" : "Hidden"}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          {adding && <AddAreasForm areas={areas} stores={stores} onDone={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && <EditAreaForm area={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers won&apos;t be able to choose it at checkout. Orders already placed keep
              it. To take it off checkout for a while, hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const area = pendingDelete
                try {
                  await del.mutateAsync(area.id)
                  setSelected((prev) => {
                    const next = new Set(prev)
                    next.delete(area.id)
                    return next
                  })
                  toast({ title: `${area.name} deleted` })
                } catch (err) {
                  toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
                }
                setPendingDelete(null)
              }}
            >
              Delete area
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
