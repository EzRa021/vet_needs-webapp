"use client"

import { RotateCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PricingSwitch from "@/components/admin/delivery/pricing-switch"
import ZonePrices from "@/components/admin/delivery/zone-prices"
import AreasPanel from "@/components/admin/delivery/areas-panel"
import PickupPanel from "@/components/admin/delivery/pickup-panel"
import BandsPanel from "@/components/admin/delivery/bands-panel"
import PriceTester from "@/components/admin/delivery/price-tester"
import { useDeliveryAdmin } from "@/stores/deliveryAdminStore"

// Delivery (028): what delivery costs by area and order weight, which areas
// customers can choose, where they can collect, and the switch that puts
// area pricing in front of customers.
export default function AdminDeliveryPage() {
  const { data, isLoading, isError, refetch, isFetching } = useDeliveryAdmin()
  const unassigned = data?.areas.filter((a) => !a.zone_id).length || 0
  const activePickup = data?.pickupPoints.some((p) => p.is_active)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold">Delivery</h1>
        <p className="text-sm text-muted-foreground">
          What delivery costs by area and order weight, and where customers can collect.
        </p>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load delivery settings</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>If this is a new setup, run migration 028 in Supabase, then try again.</span>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => refetch()} disabled={isFetching}>
              <RotateCw data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <PricingSwitch data={data} />

          <Tabs defaultValue="prices" className="flex flex-col gap-4">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              <TabsTrigger value="prices">Prices</TabsTrigger>
              <TabsTrigger value="areas" className="gap-1.5">
                Areas
                {unassigned > 0 && (
                  <Badge variant="secondary" className="px-1.5 tabular-nums" aria-label={`${unassigned} not in a zone`}>
                    {unassigned}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pickup" className="gap-1.5">
                Pickup
                {!activePickup && <span className="text-xs text-muted-foreground">(off)</span>}
              </TabsTrigger>
              <TabsTrigger value="weights">Weight bands</TabsTrigger>
            </TabsList>

            <TabsContent value="prices" className="mt-0 flex flex-col gap-4">
              <ZonePrices data={data} />
              <div className="lg:max-w-xl">
                <PriceTester data={data} />
              </div>
            </TabsContent>
            <TabsContent value="areas" className="mt-0">
              <AreasPanel data={data} />
            </TabsContent>
            <TabsContent value="pickup" className="mt-0">
              <PickupPanel data={data} />
            </TabsContent>
            <TabsContent value="weights" className="mt-0">
              <BandsPanel data={data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
