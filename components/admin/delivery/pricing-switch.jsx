"use client"

import { MapPinned } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAdminSettings, useSaveSettings } from "@/stores/adminStore"

// The master switch for area pricing (028). Off, checkout prices every
// delivery by state, exactly as before. It starts off so the shop can fill in
// prices first; this card says how ready that is.
export default function PricingSwitch({ data }) {
  const { toast } = useToast()
  const { data: settings, isLoading } = useAdminSettings()
  const save = useSaveSettings()
  const on = (settings || []).find((s) => s.key === "area_pricing_enabled")?.value === true

  const { zones, rates, areas } = data
  const priced = new Set(
    zones
      .filter((z) => z.city && z.is_active && (rates[z.id] || (z.fee !== null && z.fee !== undefined)))
      .map((z) => z.id)
  )
  const offered = areas.filter((a) => a.is_active && priced.has(a.zone_id)).length

  const toggle = async (value) => {
    try {
      await save.mutateAsync({ area_pricing_enabled: value })
      toast({
        title: value ? "Area pricing is on" : "Area pricing is off",
        description: value
          ? "Customers in your cities now choose their area at checkout."
          : "Checkout prices delivery by state again.",
      })
    } catch (err) {
      toast({ title: "Couldn't change area pricing", description: err.message, variant: "destructive" })
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <MapPinned className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="area-pricing" className="font-display font-semibold">
              Price by area {on ? "is on" : "is off"}
            </label>
            <p className="text-sm text-muted-foreground">
              {on
                ? "Customers in your cities pick their area at checkout and pay that area's price for the order's weight."
                : "Checkout prices delivery by state only. Turn this on once your areas have prices."}
            </p>
            <p className="text-sm">
              <span className="font-medium tabular-nums">{offered}</span>
              <span className="text-muted-foreground"> of </span>
              <span className="tabular-nums">{areas.length}</span>
              <span className="text-muted-foreground">
                {" "}areas can be chosen at checkout
                {on && offered === 0 ? ". Until some can, everyone is priced by state." : "."}
              </span>
            </p>
          </div>
        </div>
        <Switch
          id="area-pricing"
          checked={on}
          onCheckedChange={toggle}
          disabled={isLoading || save.isPending}
        />
      </CardContent>
    </Card>
  )
}
