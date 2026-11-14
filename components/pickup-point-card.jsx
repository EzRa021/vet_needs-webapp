import { Clock, MapPin, Phone, Store } from "lucide-react"

import { pickupMapLink } from "@/lib/delivery"
import { cn } from "@/lib/utils"

// Where to collect a pickup order (028). Used at checkout, on the customer's
// order pages and on the staff order page, so the store reads the same
// everywhere. `code` shows the six digits the customer gives at the counter.
export default function PickupPointCard({ point, code, className }) {
  if (!point) return null
  const map = pickupMapLink(point)

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 text-sm", className)}>
      <div className="flex items-start gap-3">
        <Store className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium">{point.name}</p>
          {point.address && <p className="text-muted-foreground">{point.address}</p>}
          <p className="text-muted-foreground">
            {[point.city, point.state].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      {(point.hours || point.phone || map) && (
        <ul className="flex flex-col gap-1.5 pl-8">
          {point.hours && (
            <li className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{point.hours}</span>
            </li>
          )}
          {point.phone && (
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a href={`tel:${point.phone.replace(/\s+/g, "")}`} className="text-primary underline-offset-4 hover:underline">
                {point.phone}
              </a>
            </li>
          )}
          {map && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a
                href={map}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Open in Google Maps
              </a>
            </li>
          )}
        </ul>
      )}

      {point.instructions && <p className="pl-8 text-muted-foreground">{point.instructions}</p>}

      {code && (
        <div className="ml-8 flex flex-col gap-1 rounded-md border bg-card p-3">
          <span className="text-xs text-muted-foreground">Pickup code — show this when you collect</span>
          <span className="font-display text-2xl font-bold tabular-nums tracking-[0.2em]">{code}</span>
        </div>
      )}
    </div>
  )
}
