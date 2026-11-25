"use client"

import { CircleAlert, Store, Truck } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAdminSettings, useSaveSettings } from "@/stores/adminStore"

// The two ways an order can reach a customer (029), each switched on or off
// for the whole shop. Checkout offers only what's on. One must stay on — the
// switch for the last one is locked, and the server refuses it too.
function MethodRow({ id, icon: Icon, title, on, locked, busy, onChange, summary, warning }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className="font-display font-semibold">
            {title}
          </label>
          <span className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{on ? "On" : "Off"}</span>
            <Switch id={id} checked={on} onCheckedChange={onChange} disabled={busy || locked} />
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{summary}</p>
        {locked && (
          <p className="text-sm text-muted-foreground">
            This is the only way customers can get their order, so it stays on.
          </p>
        )}
        {warning && (
          <p className="flex items-start gap-1.5 text-sm text-earth">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{warning}</span>
          </p>
        )}
      </div>
    </div>
  )
}

export default function MethodsCard({ data }) {
  const { toast } = useToast()
  const { data: settings, isLoading } = useAdminSettings()
  const save = useSaveSettings()
  const value = (key) => (settings || []).find((s) => s.key === key)?.value !== false
  const doorOn = value("doorstep_delivery_enabled")
  const pickupOn = value("store_pickup_enabled")

  const { areas, stores } = data
  const shown = areas.filter((a) => a.is_active)
  const priced = shown.filter((a) => a.delivery_fee !== null).length
  const openStores = stores.filter((s) => s.is_active)
  const openIds = new Set(openStores.map((s) => s.id))
  const assigned = shown.filter((a) => openIds.has(a.pickup_point_id)).length

  const toggle = (key, label) => async (next) => {
    try {
      await save.mutateAsync({ [key]: next })
      toast({ title: `${label} is ${next ? "on" : "off"}` })
    } catch (err) {
      toast({ title: `Couldn't change ${label.toLowerCase()}`, description: err.message, variant: "destructive" })
    }
  }

  const busy = isLoading || save.isPending

  return (
    <Card>
      <CardContent className="grid gap-5 p-4 md:grid-cols-2 md:gap-8 md:p-5">
        <MethodRow
          id="door-delivery"
          icon={Truck}
          title="Deliver to the door"
          on={doorOn}
          locked={doorOn && !pickupOn}
          busy={busy}
          onChange={toggle("doorstep_delivery_enabled", "Door delivery")}
          summary={
            <>
              <span className="font-medium text-foreground tabular-nums">{priced}</span> of{" "}
              <span className="tabular-nums">{shown.length}</span> areas have a delivery price.
              Areas without one are pickup only.
            </>
          }
          warning={doorOn && priced === 0 ? "No area has a price yet, so customers can't choose delivery." : null}
        />
        <MethodRow
          id="store-pickup"
          icon={Store}
          title="Pick up at a store"
          on={pickupOn}
          locked={pickupOn && !doorOn}
          busy={busy}
          onChange={toggle("store_pickup_enabled", "Store pickup")}
          summary={
            <>
              <span className="font-medium text-foreground tabular-nums">{openStores.length}</span>{" "}
              {openStores.length === 1 ? "store is" : "stores are"} open for pickup, and{" "}
              <span className="tabular-nums">{assigned}</span> of{" "}
              <span className="tabular-nums">{shown.length}</span> areas have their store set.
            </>
          }
          warning={
            pickupOn && openStores.length === 0
              ? "No store is open for pickup yet, so customers can't choose it. Add one under Stores."
              : null
          }
        />
      </CardContent>
    </Card>
  )
}
