"use client"

import { Banknote, LocateFixed, MapPin, MessageCircle, Phone, Scale, Store, Truck, TriangleAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PickupPointCard from "@/components/pickup-point-card"
import { customerWhatsappLink, formatWeight, isQuoteDelivery, mapsLink } from "@/lib/delivery"
import { LEGAL } from "@/lib/legal"
import { orderRef } from "@/lib/order-status"
import { formatNaira } from "@/lib/pricing"

function Line({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="min-w-0 break-words">{children}</span>
      </div>
    </div>
  )
}

// How this order reaches the customer and what was charged for it, read from
// the snapshot create-order froze on the order. Orders since 029 carry the
// area, its price and the pickup store; orders from 028 also carried a weight
// and the customer's GPS point, shown when present. Orders placed before 028
// have no snapshot and show nothing here.
export default function DeliveryDetails({ order }) {
  const d = order.delivery
  if (!d) return null
  const isPickup = order.fulfilment_method === "pickup"
  const map = mapsLink(d.location)

  const fee = d.fee === null || d.fee === undefined ? null : Number(d.fee)
  const where = d.area
    ? `${d.area.name}, ${d.area.city}`
    : d.town
      ? `${d.town}, ${d.state || ""}`
      : d.unlisted_city
      ? `Not in the area list — somewhere in ${d.unlisted_city}`
      : d.matched_by === "state" || d.matched_by === "catch_all" || d.matched_by === "flat"
        ? "Priced by state"
        : null

  // Delivery outside the fixed-price states (031): nobody has paid for it
  // yet, and the order shouldn't leave until the fee is agreed.
  const feeToAgree = isQuoteDelivery(order)
  const phone = (order.shipping_address || "").match(/^Phone:\s*(.+)$/m)?.[1]?.trim() || ""
  const firstName = (order.shipping_address || "").split("\n")[0]?.split(" ")[0] || ""
  const whatsapp = feeToAgree
    ? customerWhatsappLink(
        phone,
        `Hi${firstName ? ` ${firstName}` : ""}, this is ${LEGAL.brand} about your order ${orderRef(order.id)} for delivery to ${where || d.state || "you"}. Let's agree the delivery fee.`
      )
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {isPickup ? (
            <Store className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <Truck className="size-4 text-primary" aria-hidden="true" />
          )}
          {isPickup ? "Store pickup" : "Delivery"}
        </CardTitle>
        <CardDescription>
          {isPickup
            ? "Ask for the pickup code before handing the order over."
            : "Give the rider the area, address and landmark."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {feeToAgree && (
          <Alert className="border-earth/60 bg-earth/10 [&>svg]:text-earth">
            <MessageCircle />
            <AlertTitle>Delivery fee to agree</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                This order is outside the fixed-price states, so the customer hasn&apos;t paid
                for delivery. Agree the fee and how they&apos;ll pay it before you send it.
              </span>
              {phone && (
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                      <Phone data-icon="inline-start" />
                      Call {phone}
                    </a>
                  </Button>
                  {whatsapp && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                        <MessageCircle data-icon="inline-start" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        {isPickup ? (
          <>
            {d.area && (
              <Line icon={MapPin} label="Customer's area">
                {d.area.name}, {d.area.city}
              </Line>
            )}
            <PickupPointCard point={d.pickup_point} code={order.pickup_code} />
          </>
        ) : (
          <>
            {where && <Line icon={MapPin} label="Area">{where}</Line>}
            {d.landmark && <Line icon={MapPin} label="Landmark">{d.landmark}</Line>}
            {d.location && (
              <Line icon={LocateFixed} label="Customer's GPS location">
                {map ? (
                  <a
                    href={map}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open in Google Maps
                    {Number.isFinite(Number(d.location?.accuracy_m)) && (
                      <span className="font-normal text-muted-foreground tabular-nums">
                        {" "}(within {Number(d.location.accuracy_m) >= 1000
                          ? `${(Number(d.location.accuracy_m) / 1000).toFixed(1)} km`
                          : `${Number(d.location.accuracy_m)} m`})
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not shared</span>
                )}
              </Line>
            )}
          </>
        )}

        {feeToAgree && (
          <Line icon={Banknote} label="Delivery price">
            <span>To be agreed with the customer</span>
          </Line>
        )}
        {fee !== null && (
          <Line icon={Banknote} label={isPickup ? "Pickup fee charged" : "Delivery price charged"}>
            <span className="tabular-nums">{fee > 0 ? formatNaira(fee) : "Free"}</span>
          </Line>
        )}

        {d.weight_kg !== undefined && d.weight_kg !== null && (
          <Line icon={Scale} label="Priced as">
            <span className="tabular-nums">{formatWeight(d.weight_kg)}</span>
            {d.band?.label && <span className="text-muted-foreground"> · {d.band.label}</span>}
            {d.zone?.name && <span className="text-muted-foreground"> · {d.zone.name}</span>}
          </Line>
        )}

        {d.missing_weight?.length > 0 && (
          <Alert>
            <TriangleAlert />
            <AlertDescription>
              Priced without a weight for {d.missing_weight.join(", ")}. Add weights to these
              products so delivery isn&apos;t undercharged.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
