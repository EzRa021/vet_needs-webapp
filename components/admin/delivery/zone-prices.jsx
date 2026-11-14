"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { bandLabel } from "@/lib/delivery"
import { cn } from "@/lib/utils"
import { useDeleteZone, useSaveRates } from "@/stores/deliveryAdminStore"
import ZoneDialog from "./zone-dialog"

const valid = (v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0)

// Groups zones into one table per city (area zones) plus "Other states".
function sectionsFor(zones) {
  const byCity = new Map()
  const states = []
  for (const z of zones) {
    if (!z.city) {
      states.push(z)
      continue
    }
    const key = z.city.toLowerCase()
    if (!byCity.has(key)) byCity.set(key, { key, city: z.city, zones: [] })
    byCity.get(key).zones.push(z)
  }
  return [...byCity.values(), { key: "__states", city: null, zones: states }]
}

// The price table (028): one row per zone, one column per weight band.
// Edits are kept as a draft and saved together, so a half-typed price never
// reaches a customer.
export default function ZonePrices({ data }) {
  const { toast } = useToast()
  const saveRates = useSaveRates()
  const deleteZone = useDeleteZone()
  const { zones, rates, bands, areas } = data

  // { [zoneId]: { [bandId]: "1500" | "" } } — only cells someone touched.
  const [draft, setDraft] = useState({})
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const sections = useMemo(() => sectionsFor(zones), [zones])
  const areaCount = useMemo(() => {
    const counts = {}
    for (const a of areas) if (a.zone_id) counts[a.zone_id] = (counts[a.zone_id] || 0) + 1
    return counts
  }, [areas])

  const saved = (zoneId, bandId) => {
    const v = rates[zoneId]?.[bandId]
    return v === undefined ? "" : String(v)
  }
  const cell = (zoneId, bandId) => draft[zoneId]?.[bandId] ?? saved(zoneId, bandId)

  const changes = Object.entries(draft).flatMap(([zoneId, byBand]) =>
    Object.entries(byBand)
      .filter(([bandId, v]) => v !== saved(zoneId, bandId))
      .map(([bandId, v]) => ({ zoneId, bandId, v }))
  )
  const hasInvalid = changes.some((c) => !valid(c.v))

  const setCell = (zoneId, bandId, value) =>
    setDraft((d) => ({ ...d, [zoneId]: { ...d[zoneId], [bandId]: value } }))

  const submit = async () => {
    const fees = {}
    for (const { zoneId, bandId, v } of changes) (fees[zoneId] ||= {})[bandId] = v
    try {
      await saveRates.mutateAsync(fees)
      setDraft({})
      toast({ title: `${changes.length} price${changes.length === 1 ? "" : "s"} saved` })
    } catch (err) {
      toast({ title: "Couldn't save prices", description: err.message, variant: "destructive" })
    }
  }

  const placeholderFor = (zone) => {
    if (rates[zone.id]) return "Call us"
    // Whole naira: the cell is narrow and "₦1,500.00" doesn't fit.
    if (zone.fee !== null && zone.fee !== undefined) {
      return `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(zone.fee)} flat`
    }
    return "Not set"
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Prices are what the customer pays for delivery, by the order&apos;s total weight. Leave a
        price empty and customers in that zone are asked to call you or collect from the store
        instead. They&apos;re never charged ₦0 by accident.
      </p>

      {sections.map((section) => {
        const cityAreas = section.city
          ? areas.filter((a) => a.city.toLowerCase() === section.key)
          : []
        const unassigned = cityAreas.filter((a) => !a.zone_id).length
        return (
          <Card key={section.key}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">{section.city || "Other states"}</CardTitle>
                <CardDescription>
                  {section.city ? (
                    <>
                      <span className="tabular-nums">{cityAreas.length}</span> areas
                      {unassigned > 0 && (
                        <>
                          {" · "}
                          <span className="font-medium text-foreground tabular-nums">{unassigned}</span> not in a
                          zone yet, so customers can&apos;t choose them
                        </>
                      )}
                    </>
                  ) : (
                    "Priced by state. Used for deliveries outside the cities above."
                  )}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing({ city: section.city ?? null, is_active: true })}
              >
                <Plus data-icon="inline-start" />
                {section.city ? `Add ${section.city} zone` : "Add state zone"}
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {section.zones.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted-foreground">
                  No state zones. Deliveries outside your cities use the flat fee in Settings.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px] pl-6">Zone</TableHead>
                        {bands.map((b) => (
                          <TableHead key={b.id} className="min-w-[120px] whitespace-nowrap">
                            {bandLabel(b)}
                          </TableHead>
                        ))}
                        <TableHead className="whitespace-nowrap">Free over</TableHead>
                        <TableHead className="w-[88px] pr-6">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.zones.map((z) => (
                        <TableRow key={z.id} className={cn(!z.is_active && "opacity-60")}>
                          <TableCell className="pl-6 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                                {z.name}
                                {!z.is_active && <Badge variant="outline">Off</Badge>}
                                {z.is_city_fallback && <Badge variant="secondary">Unlisted areas</Badge>}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {z.city
                                  ? `${areaCount[z.id] || 0} areas`
                                  : z.states.length
                                    ? z.states.join(", ")
                                    : "Anywhere not priced elsewhere"}
                                {z.delivery_estimate ? ` · ${z.delivery_estimate}` : ""}
                              </span>
                            </div>
                          </TableCell>
                          {bands.map((b) => {
                            const value = cell(z.id, b.id)
                            const bad = !valid(value)
                            const changed = value !== saved(z.id, b.id)
                            return (
                              <TableCell key={b.id} className="align-top">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="50"
                                  aria-label={`${z.name}, ${bandLabel(b)}, price in naira`}
                                  aria-invalid={bad || undefined}
                                  value={value}
                                  placeholder={placeholderFor(z)}
                                  onChange={(e) => setCell(z.id, b.id, e.target.value)}
                                  className={cn(
                                    "h-9 w-[110px] tabular-nums",
                                    changed && !bad && "border-primary",
                                    bad && "border-destructive"
                                  )}
                                />
                              </TableCell>
                            )
                          })}
                          <TableCell className="whitespace-nowrap align-top text-sm tabular-nums text-muted-foreground">
                            <span className="inline-block pt-2">
                              {z.free_over === null ? "Never" : formatNaira(z.free_over)}
                            </span>
                          </TableCell>
                          <TableCell className="pr-6 align-top">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                onClick={() => setEditing(z)}
                                aria-label={`Edit ${z.name}`}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-destructive hover:text-destructive"
                                onClick={() => setPendingDelete(z)}
                                aria-label={`Delete ${z.name}`}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Unsaved changes stay in view wherever the staff member has scrolled. */}
      {changes.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-card-hover">
          <p className="flex items-center gap-2 text-sm">
            {hasInvalid && <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />}
            {hasInvalid
              ? "A price must be a number of zero or more."
              : `${changes.length} price${changes.length === 1 ? "" : "s"} changed, not saved yet`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraft({})} disabled={saveRates.isPending}>
              Discard
            </Button>
            <Button size="sm" onClick={submit} disabled={hasInvalid || saveRates.isPending}>
              {saveRates.isPending && <Spinner data-icon="inline-start" />}
              Save prices
            </Button>
          </div>
        </div>
      )}

      <ZoneDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} zone={editing} />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.city && areaCount[pendingDelete.id]
                ? `Its ${areaCount[pendingDelete.id]} areas become unassigned, and customers can't choose them until you put them in another zone. `
                : ""}
              Orders already placed keep the fee they were charged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await deleteZone.mutateAsync(pendingDelete.id)
                  toast({ title: "Zone deleted" })
                } catch (err) {
                  toast({ title: "Couldn't delete", description: err.message, variant: "destructive" })
                }
                setPendingDelete(null)
              }}
            >
              Delete zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
