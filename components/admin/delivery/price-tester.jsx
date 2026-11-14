"use client"

import { useMemo, useState } from "react"
import { CircleAlert, CircleCheck, FlaskConical } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { bandLabel, formatWeight } from "@/lib/delivery"
import { formatNaira } from "@/lib/pricing"
import { useDebounce } from "@/hooks/use-debounce"
import { useTestPrice } from "@/stores/deliveryAdminStore"

// "What would a customer pay?" — runs the resolver checkout uses, so staff
// can check a price before a customer finds the mistake.
export default function PriceTester({ data }) {
  const { areas } = data
  const [where, setWhere] = useState("")
  const [state, setState] = useState("")
  const [weight, setWeight] = useState("25")
  const debouncedWeight = useDebounce(weight, 300)

  const cities = useMemo(() => {
    const map = new Map()
    for (const a of areas) {
      if (!map.has(a.city)) map.set(a.city, [])
      map.get(a.city).push(a)
    }
    return [...map.entries()]
  }, [areas])

  const input = useMemo(() => {
    if (where.startsWith("area:")) return { areaId: where.slice(5), weightKg: debouncedWeight }
    if (where.startsWith("city:")) return { city: where.slice(5), weightKg: debouncedWeight }
    if (where === "state") return { state, weightKg: debouncedWeight }
    return null
  }, [where, state, debouncedWeight])

  const ready = Boolean(input) && (where !== "state" || Boolean(state)) && Number(debouncedWeight) >= 0
  const { data: result, isFetching, isError } = useTestPrice(input || {}, { enabled: ready })

  const area = where.startsWith("area:") ? areas.find((a) => a.id === where.slice(5)) : null

  let outcome = null
  if (ready && !isFetching) {
    if (isError) {
      outcome = { ok: false, text: "Couldn't check that price. Try again." }
    } else if (!result) {
      outcome = {
        ok: false,
        text: area
          ? area.zone_id
            ? `${area.name} isn't offered: its zone is switched off or ${area.is_active ? "missing" : "the area is off"}.`
            : `${area.name} isn't in a zone, so customers can't choose it.`
          : where.startsWith("city:")
            ? `No zone in ${where.slice(5)} is set for unlisted areas.`
            : "No state zone matches, so checkout uses the flat fee in Settings.",
      }
    } else if (result.fee === null) {
      outcome = {
        ok: false,
        text: `${result.zone_name} has no price for ${bandLabel({
          from_kg: result.band_from_kg,
          up_to_kg: result.band_up_to_kg,
        }) || "this weight"}. The customer is asked to call or collect.`,
      }
    } else {
      outcome = {
        ok: true,
        fee: Number(result.fee),
        text: `${result.zone_name} · ${bandLabel({ from_kg: result.band_from_kg, up_to_kg: result.band_up_to_kg })}${
          result.free_over !== null ? ` · free over ${formatNaira(result.free_over)}` : ""
        }`,
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-primary" aria-hidden="true" />
          Test a price
        </CardTitle>
        <CardDescription>What a customer pays for delivery, with area pricing on.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field>
            <FieldLabel htmlFor="t-where">Delivering to</FieldLabel>
            <Select value={where} onValueChange={setWhere}>
              <SelectTrigger id="t-where">
                <SelectValue placeholder="Choose an area" />
              </SelectTrigger>
              <SelectContent>
                {cities.map(([city, list]) => (
                  <SelectGroup key={city}>
                    <SelectLabel>{city}</SelectLabel>
                    {list.map((a) => (
                      <SelectItem key={a.id} value={`area:${a.id}`}>
                        {a.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={`city:${city}`}>An unlisted area in {city}</SelectItem>
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>Elsewhere</SelectLabel>
                  <SelectItem value="state">Another state…</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="t-weight">Order weight</FieldLabel>
            <div className="relative">
              <Input
                id="t-weight"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="pr-10 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                kg
              </span>
            </div>
          </Field>
        </div>

        {where === "state" && (
          <Field>
            <FieldLabel htmlFor="t-state">State</FieldLabel>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="t-state">
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
        )}

        <div className="min-h-[64px] rounded-lg border bg-muted/40 p-3" aria-live="polite">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Choose where it&apos;s going to see the price.</p>
          ) : isFetching ? (
            <Spinner className="text-muted-foreground" />
          ) : outcome?.ok ? (
            <div className="flex items-start gap-2">
              <CircleCheck className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold tabular-nums">{formatNaira(outcome.fee)}</span>
                <span className="text-sm text-muted-foreground">
                  {formatWeight(debouncedWeight)} · {outcome.text}
                </span>
              </div>
            </div>
          ) : outcome ? (
            <p className="flex items-start gap-2 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              {outcome.text}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
