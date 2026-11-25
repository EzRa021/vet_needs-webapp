"use client"

import { useMemo, useState } from "react"
import { CircleAlert, MapPinned, MessageCircle, Search, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useSetStateMode } from "@/stores/deliveryAdminStore"

// States (031): how door delivery is priced in each state.
//   fixed  customers pick their area and pay its price at checkout
//   quote  customers order now; staff agree the fee by call or WhatsApp
// A state set to fixed with no priced area yet still gets quotes at
// checkout, so switching early never blocks a customer — this panel says so.

const MODES = [
  { value: "fixed", label: "Fixed area prices" },
  { value: "quote", label: "Quote by call or WhatsApp" },
]

export default function StatesPanel({ data, onShowAreas }) {
  const { toast } = useToast()
  const setMode = useSetStateMode()
  const [query, setQuery] = useState("")
  const states = data.states

  const counts = useMemo(() => {
    const byState = new Map()
    for (const a of data.areas) {
      if (!a.is_active) continue
      const c = byState.get(a.state) || { areas: 0, priced: 0 }
      c.areas += 1
      if (a.delivery_fee !== null) c.priced += 1
      byState.set(a.state, c)
    }
    return byState
  }, [data.areas])

  if (!states) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>States aren&apos;t set up yet</AlertTitle>
        <AlertDescription>
          Run migration 031 in Supabase, then reload this page. Until then checkout uses fixed
          prices for Oyo and quotes for every other state.
        </AlertDescription>
      </Alert>
    )
  }

  const fixedCount = states.filter((s) => s.pricing_mode === "fixed").length
  const q = query.trim().toLowerCase()
  // Fixed-price states first — they're the ones with prices to look after —
  // then the rest A–Z.
  const shown = states
    .filter((s) => !q || s.state.toLowerCase().includes(q))
    .sort((a, b) => (a.pricing_mode === b.pricing_mode ? a.state.localeCompare(b.state) : a.pricing_mode === "fixed" ? -1 : 1))

  const change = async (state, pricing_mode) => {
    try {
      await setMode.mutateAsync({ state, pricing_mode })
      toast({
        title:
          pricing_mode === "fixed"
            ? `${state} now uses fixed area prices`
            : `${state} is now priced by call or WhatsApp`,
      })
    } catch (err) {
      toast({ title: `Couldn't change ${state}`, description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          How door delivery is priced in each state. With fixed prices, customers pick their area
          and pay its price at checkout. Otherwise they order now and you agree the fee with them by
          call or WhatsApp.
        </p>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search states"
            aria-label="Search states"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <p className="text-sm">
        <span className="font-medium tabular-nums">{fixedCount}</span>{" "}
        {fixedCount === 1 ? "state uses" : "states use"} fixed area prices;{" "}
        <span className="tabular-nums">{states.length - fixedCount}</span> are priced by call or
        WhatsApp.
      </p>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No state matches “{query}”.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((s) => {
              const c = counts.get(s.state) || { areas: 0, priced: 0 }
              const fixed = s.pricing_mode === "fixed"
              const waiting = fixed && c.priced === 0
              return (
                <li
                  key={s.state}
                  className={cn(
                    "grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_16rem]",
                    fixed && "bg-primary/5"
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {s.state}
                      {fixed ? (
                        <Badge variant="default" className="gap-1">
                          <MapPinned className="size-3" aria-hidden="true" />
                          Fixed prices
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <MessageCircle className="size-3" aria-hidden="true" />
                          Quote
                        </Badge>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {c.areas === 0 ? (
                        "No areas"
                      ) : (
                        <>
                          <span className="tabular-nums">{c.areas}</span> {c.areas === 1 ? "area" : "areas"},{" "}
                          <span className="tabular-nums">{c.priced}</span> with a price
                        </>
                      )}
                      {onShowAreas && (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            onClick={() => onShowAreas(s.state)}
                          >
                            {c.areas ? "Edit areas" : "Add areas"}
                          </button>
                        </>
                      )}
                    </span>
                    {waiting && (
                      <span className="flex items-start gap-1.5 text-sm text-earth">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        No area has a price yet, so customers here still get a quote by call or
                        WhatsApp.
                      </span>
                    )}
                  </div>
                  <Select value={s.pricing_mode} onValueChange={(v) => v !== s.pricing_mode && change(s.state, v)}>
                    <SelectTrigger className="h-10" aria-label={`How delivery is priced in ${s.state}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
