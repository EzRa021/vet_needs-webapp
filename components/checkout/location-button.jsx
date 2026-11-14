"use client"

import { useState } from "react"
import { CircleAlert, CircleCheck, LocateFixed, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { mapsLink } from "@/lib/delivery"

// "Use my current location" (028). Saves the phone's GPS point on the order so
// the rider gets a map link straight to the door — typed Nigerian addresses
// often don't resolve, and a landmark only gets them to the street.
//
// Optional by design: it never decides the price (the area does), and a
// customer ordering for someone else, or on a laptop whose location is a
// guess from Wi-Fi, can skip it.
const MESSAGES = {
  1: "Location access is blocked. Allow it for this site in your browser settings, or skip this — your address and landmark are enough.",
  2: "Your device couldn't find your location. Try again outside or near a window, or skip this.",
  3: "Finding your location took too long. Try again, or skip this.",
  unsupported: "This browser can't share your location. Your address and landmark are enough.",
}

export default function LocationButton({ value, onChange }) {
  const [status, setStatus] = useState("idle") // idle | locating | error
  const [error, setError] = useState(null)

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error")
      setError(MESSAGES.unsupported)
      return
    }
    setStatus("locating")
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus("idle")
      },
      (err) => {
        setStatus("error")
        setError(MESSAGES[err.code] || MESSAGES[2])
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  if (value) {
    const accuracy = Number(value.accuracy)
    // Past ~1 km the point is a Wi-Fi guess, not the customer's door.
    const rough = Number.isFinite(accuracy) && accuracy > 1000
    const link = mapsLink(value)
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm" role="status">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2">
            {rough ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-earth" aria-hidden="true" />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            )}
            <span>
              <span className="font-medium">
                {rough ? "Location saved, but it's rough" : "Location saved for the rider"}
              </span>
              {Number.isFinite(accuracy) && (
                <span className="text-muted-foreground">
                  {" "}
                  — accurate to about{" "}
                  <span className="tabular-nums">
                    {accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`}
                  </span>
                </span>
              )}
            </span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onChange(null)}
            aria-label="Remove saved location"
          >
            <X />
          </Button>
        </div>
        {rough && (
          <p className="text-muted-foreground">
            This looks like an estimate from your network. If you&apos;re not at the delivery
            address, remove it.
          </p>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Check it on Google Maps
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-fit"
        onClick={locate}
        disabled={status === "locating"}
      >
        {status === "locating" ? <Spinner data-icon="inline-start" /> : <LocateFixed data-icon="inline-start" />}
        {status === "locating" ? "Finding your location…" : "Use my current location"}
      </Button>
      {status === "error" && error ? (
        <p className="text-sm text-muted-foreground" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Optional. Do this if you&apos;re at the delivery address, so the rider can find you.
        </p>
      )}
    </div>
  )
}
