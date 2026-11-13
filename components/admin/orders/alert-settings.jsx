"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, BellRing, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  notificationPermission,
  playChime,
  requestNotificationPermission,
  showDesktopNotification,
  unlockAudio,
} from "@/lib/order-alerts"
import { useOrderLiveStore } from "@/stores/orderLiveStore"

// Permission can change in browser settings while the page is open; re-read
// it whenever the tab regains focus.
export function useNotificationPermission() {
  const [permission, setPermission] = useState("default")
  useEffect(() => {
    const read = () => setPermission(notificationPermission())
    read()
    window.addEventListener("focus", read)
    return () => window.removeEventListener("focus", read)
  }, [])
  const request = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
    return result
  }
  return { permission, request }
}

function ToggleRow({ id, label, description, checked, onCheckedChange, disabled }) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </Field>
  )
}

export default function AlertSettings() {
  const prefs = useOrderLiveStore((s) => s.prefs)
  const setPrefs = useOrderLiveStore((s) => s.setPrefs)
  const { permission, request } = useNotificationPermission()

  const muted = !prefs.sound && !prefs.desktop
  const TriggerIcon = muted ? BellOff : prefs.sound ? BellRing : Bell

  const desktopHelp = {
    granted: "Shown when this tab isn't in front.",
    denied: "Blocked by the browser. Allow notifications for this site in the address bar, then reload.",
    unsupported: "This browser can't show desktop notifications.",
    default: "Your browser will ask for permission.",
  }[permission]

  const onDesktopChange = async (on) => {
    if (on && permission === "default") {
      const result = await request()
      setPrefs({ desktop: result === "granted" })
      return
    }
    setPrefs({ desktop: on })
  }

  const test = () => {
    unlockAudio()
    playChime("payment", prefs.volume)
    if (prefs.desktop && permission === "granted") {
      showDesktopNotification({
        title: "Order alerts are on",
        body: "This is how a new order or payment will look.",
        tag: "vn-test-alert",
        url: "/admin/orders",
      })
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Order alert settings">
          <TriggerIcon data-icon="inline-start" />
          Alerts
          {muted && <span className="text-muted-foreground">off</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-display text-sm font-semibold">Order alerts</p>
            <p className="text-xs text-muted-foreground">
              Saved for this browser. Each alert plays once, however many admin tabs are open.
            </p>
          </div>

          <FieldGroup className="gap-4">
            <ToggleRow
              id="alert-sound"
              label="Sound"
              checked={prefs.sound}
              onCheckedChange={(v) => {
                unlockAudio()
                setPrefs({ sound: v })
              }}
            />
            {prefs.sound && (
              <Field orientation="horizontal">
                <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Slider
                  aria-label="Alert volume"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={[prefs.volume]}
                  onValueChange={([v]) => setPrefs({ volume: v })}
                  onValueCommit={([v]) => playChime("order", v)}
                />
              </Field>
            )}
            <ToggleRow
              id="alert-desktop"
              label="Desktop notifications"
              description={desktopHelp}
              checked={prefs.desktop && permission === "granted"}
              disabled={permission === "denied" || permission === "unsupported"}
              onCheckedChange={onDesktopChange}
            />

            <Separator />

            <ToggleRow
              id="alert-new"
              label="New orders"
              description="When a customer places an order, before payment."
              checked={prefs.onNewOrder}
              onCheckedChange={(v) => setPrefs({ onNewOrder: v })}
            />
            <ToggleRow
              id="alert-paid"
              label="Payments"
              description="When Paystack confirms a payment. A different, brighter chime."
              checked={prefs.onPayment}
              onCheckedChange={(v) => setPrefs({ onPayment: v })}
            />
          </FieldGroup>

          <Button variant="secondary" size="sm" onClick={test}>
            <BellRing data-icon="inline-start" />
            Play a test alert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
