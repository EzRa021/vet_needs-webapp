"use client"

import { useMemo, useState } from "react"
import { CircleCheck, CircleMinus, MapPinned, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { cn } from "@/lib/utils"
import {
  useAddAreas,
  useAssignAreas,
  useDeleteArea,
  useSaveArea,
} from "@/stores/deliveryAdminStore"

const NONE = "__none"
const lower = (s) => String(s || "").toLowerCase()

// Why an area is or isn't offered at checkout, in words staff can act on.
function offerStatus(area, zone, rates) {
  if (!area.is_active) return { ok: false, text: "Switched off" }
  if (!zone) return { ok: false, text: "Not in a zone" }
  if (!zone.is_active) return { ok: false, text: "Zone is off" }
  if (!rates[zone.id] && (zone.fee === null || zone.fee === undefined)) return { ok: false, text: "Zone has no prices" }
  return { ok: true, text: "Offered" }
}

// ---------- Add areas ----------
function AddAreasForm({ cities, zones, areas, defaultCity, onDone }) {
  const { toast } = useToast()
  const add = useAddAreas()
  const known = cities.find((c) => lower(c.city) === lower(defaultCity))
  const [city, setCity] = useState(known?.city || defaultCity || "")
  const [state, setState] = useState(known?.state || "")
  const [zoneId, setZoneId] = useState(NONE)
  const [names, setNames] = useState("")
  const [error, setError] = useState(null)

  const cityZones = zones.filter((z) => z.city && lower(z.city) === lower(city))
  const lines = names.split("\n").map((n) => n.trim()).filter(Boolean)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!city.trim()) return setError("Which city are these areas in?")
    if (!state) return setError("Which state is that city in?")
    if (!lines.length) return setError("Type at least one area name.")
    try {
      const { added, skipped } = await add.mutateAsync({
        city,
        state,
        zone_id: zoneId === NONE ? null : zoneId,
        names: lines,
        existing: areas.filter((a) => lower(a.city) === lower(city)).map((a) => a.name),
      })
      toast({
        title: `${added} area${added === 1 ? "" : "s"} added`,
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
        <DialogDescription>
          One area per line, named the way customers would type it. You can add other spellings
          afterwards.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="mt-4">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="aa-city">City</FieldLabel>
            <Input
              id="aa-city"
              list="aa-cities"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                const match = cities.find((c) => lower(c.city) === lower(e.target.value))
                if (match) setState(match.state)
                setZoneId(NONE)
              }}
              placeholder="e.g. Ibadan"
            />
            <datalist id="aa-cities">
              {cities.map((c) => (
                <option key={c.city} value={c.city} />
              ))}
            </datalist>
          </Field>
          <Field>
            <FieldLabel htmlFor="aa-state">State</FieldLabel>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="aa-state">
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
        <Field>
          <FieldLabel htmlFor="aa-zone">Zone</FieldLabel>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger id="aa-zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not in a zone yet</SelectItem>
              {cityZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {city && cityZones.length === 0 && (
            <FieldDescription>
              {city} has no zones yet. Add one on the Prices tab, then put these areas in it.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="aa-names">Areas</FieldLabel>
          <Textarea
            id="aa-names"
            rows={7}
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={"Bodija\nAkobo\nRing Road"}
          />
          <FieldDescription className="tabular-nums">
            {lines.length} area{lines.length === 1 ? "" : "s"}
          </FieldDescription>
        </Field>
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

// ---------- Edit one area ----------
function EditAreaForm({ area, onDone }) {
  const { toast } = useToast()
  const save = useSaveArea()
  const [name, setName] = useState(area.name)
  const [aliases, setAliases] = useState((area.aliases || []).join(", "))
  const [active, setActive] = useState(area.is_active)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError("The area needs a name.")
    try {
      await save.mutateAsync({ id: area.id, name, aliases: aliases.split(","), is_active: active })
      toast({ title: "Area saved" })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Edit {area.name}</DialogTitle>
        <DialogDescription>{area.city}, {area.state}</DialogDescription>
      </DialogHeader>
      <FieldGroup className="mt-4">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="ea-name">Name</FieldLabel>
          <Input id="ea-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="ea-aliases">Other names</FieldLabel>
          <Input
            id="ea-aliases"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="e.g. UI, U.I."
          />
          <FieldDescription>
            Comma-separated. Customers searching these find this area.
          </FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="ea-active">Offer at checkout</FieldLabel>
            <FieldDescription>Off hides it without losing its zone.</FieldDescription>
          </FieldContent>
          <Switch id="ea-active" checked={active} onCheckedChange={setActive} />
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

// ---------- The list ----------
export default function AreasPanel({ data }) {
  const { toast } = useToast()
  const { zones, rates, areas } = data
  const saveArea = useSaveArea()
  const assign = useAssignAreas()
  const del = useDeleteArea()

  const cities = useMemo(() => {
    const map = new Map()
    for (const a of areas) if (!map.has(lower(a.city))) map.set(lower(a.city), { city: a.city, state: a.state })
    for (const z of zones) if (z.city && !map.has(lower(z.city))) map.set(lower(z.city), { city: z.city, state: "" })
    return [...map.values()]
  }, [areas, zones])

  const [city, setCity] = useState(() => cities[0]?.city || "")
  const [query, setQuery] = useState("")
  const [zoneFilter, setZoneFilter] = useState("all")
  const [selected, setSelected] = useState(() => new Set())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])
  const cityZones = zones.filter((z) => z.city && lower(z.city) === lower(city))
  const inCity = areas.filter((a) => lower(a.city) === lower(city))
  const unassigned = inCity.filter((a) => !a.zone_id).length

  const q = lower(query.trim())
  const shown = inCity.filter((a) => {
    if (zoneFilter === NONE && a.zone_id) return false
    if (zoneFilter !== "all" && zoneFilter !== NONE && a.zone_id !== zoneFilter) return false
    if (!q) return true
    return lower(a.name).includes(q) || (a.aliases || []).some((x) => lower(x).includes(q))
  })

  const allShownSelected = shown.length > 0 && shown.every((a) => selected.has(a.id))
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s)
      if (allShownSelected) shown.forEach((a) => next.delete(a.id))
      else shown.forEach((a) => next.add(a.id))
      return next
    })
  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const switchCity = (next) => {
    if (!next) return
    setCity(next)
    setZoneFilter("all")
    setSelected(new Set())
  }

  const moveSelected = async (value) => {
    const ids = [...selected]
    try {
      await assign.mutateAsync({ ids, zone_id: value === NONE ? null : value })
      const zone = zoneById.get(value)
      toast({ title: `${ids.length} area${ids.length === 1 ? "" : "s"} moved to ${zone ? zone.name : "no zone"}` })
      setSelected(new Set())
    } catch (err) {
      toast({ title: "Couldn't move areas", description: err.message, variant: "destructive" })
    }
  }

  const changeZone = async (area, value) => {
    try {
      await saveArea.mutateAsync({ id: area.id, zone_id: value === NONE ? null : value })
      const zone = zoneById.get(value)
      toast({ title: `${area.name} moved to ${zone ? zone.name : "no zone"}` })
    } catch (err) {
      toast({ title: "Couldn't move area", description: err.message, variant: "destructive" })
    }
  }

  const toggleActive = async (area, value) => {
    try {
      await saveArea.mutateAsync({ id: area.id, is_active: value })
    } catch (err) {
      toast({ title: "Couldn't update area", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {cities.length > 0 ? (
          <ToggleGroup type="single" value={city} onValueChange={switchCity} variant="outline" size="sm">
            {cities.map((c) => (
              <ToggleGroupItem key={c.city} value={c.city} className="px-3">
                {c.city}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add areas
        </Button>
      </div>

      {unassigned > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertDescription>
            <span className="tabular-nums">{unassigned}</span> {city} area{unassigned === 1 ? " isn't" : "s aren't"} in a
            zone, so customers can&apos;t choose {unassigned === 1 ? "it" : "them"}. Tick them below and use
            &ldquo;Move to zone&rdquo;, or choose a zone on each row.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${city || "areas"}`}
                aria-label="Search areas"
                className="pl-9"
              />
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[200px]" aria-label="Filter by zone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                <SelectItem value={NONE}>Not in a zone</SelectItem>
                {cityZones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 pl-3" role="region" aria-label="Selected areas">
              <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
              <Select value="" onValueChange={moveSelected} disabled={assign.isPending}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue placeholder="Move to zone…" />
                </SelectTrigger>
                <SelectContent>
                  {cityZones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NONE}>Not in a zone</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              {assign.isPending && <Spinner />}
            </div>
          )}

          {inCity.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinned />
                </EmptyMedia>
                <EmptyTitle>No areas yet</EmptyTitle>
                <EmptyDescription>Add the areas you deliver to, so customers can pick theirs at checkout.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No areas match. Try another spelling or zone.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-4">
                      <Checkbox checked={allShownSelected} onCheckedChange={toggleAll} aria-label="Select all shown areas" />
                    </TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead className="min-w-[190px]">Zone</TableHead>
                    <TableHead>At checkout</TableHead>
                    <TableHead className="w-[88px] pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((a) => {
                    const zone = zoneById.get(a.zone_id)
                    const status = offerStatus(a, zone, rates)
                    return (
                      <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined}>
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={selected.has(a.id)}
                            onCheckedChange={() => toggle(a.id)}
                            aria-label={`Select ${a.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{a.name}</span>
                            {a.aliases?.length > 0 && (
                              <span className="text-xs text-muted-foreground">{a.aliases.join(", ")}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={a.zone_id || NONE} onValueChange={(v) => changeZone(a, v)}>
                            <SelectTrigger className="h-9 w-[180px]" aria-label={`Zone for ${a.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Not in a zone</SelectItem>
                              {cityZones.map((z) => (
                                <SelectItem key={z.id} value={z.id}>
                                  {z.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className={cn("flex w-[150px] items-center gap-1.5 text-sm", !status.ok && "text-muted-foreground")}>
                              {status.ok ? (
                                <CircleCheck className="size-4 text-success" aria-hidden="true" />
                              ) : (
                                <CircleMinus className="size-4" aria-hidden="true" />
                              )}
                              {status.text}
                            </span>
                            <Switch
                              checked={a.is_active}
                              onCheckedChange={(v) => toggleActive(a, v)}
                              aria-label={`Offer ${a.name} at checkout`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(a)}
                              aria-label={`Delete ${a.name}`}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {adding && (
            <AddAreasForm
              cities={cities}
              zones={zones}
              areas={areas}
              defaultCity={city}
              onDone={() => setAdding(false)}
            />
          )}
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
              Customers there can still order by choosing &ldquo;My area isn&apos;t listed&rdquo; or
              their state. To hide it for a while instead, switch it off.
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
                  setSelected((s) => {
                    const next = new Set(s)
                    next.delete(pendingDelete.id)
                    return next
                  })
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
