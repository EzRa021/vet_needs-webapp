"use client"

import { useState } from "react"
import { RotateCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import MethodsCard from "@/components/admin/delivery/methods-card"
import AreasPanel from "@/components/admin/delivery/areas-panel"
import StoresPanel from "@/components/admin/delivery/stores-panel"
import { useDeliveryAdmin } from "@/stores/deliveryAdminStore"

// Delivery (029): whether customers can have orders delivered to the door
// and/or collect from a store; the Ibadan areas, each with its delivery price
// and pickup store; and the stores themselves.
export default function AdminDeliveryPage() {
  const { data, isLoading, isError, refetch, isFetching } = useDeliveryAdmin()
  const [tab, setTab] = useState("areas")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold">Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Door delivery prices for each Ibadan area, and the store each area collects from.
        </p>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load delivery settings</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>If this is a new setup, run migration 029 in Supabase, then try again.</span>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => refetch()} disabled={isFetching}>
              <RotateCw data-icon="inline-start" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <MethodsCard data={data} />

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
            <TabsList className="w-full justify-start sm:w-fit">
              <TabsTrigger value="areas" className="gap-1.5">
                Areas
                <span className="text-xs tabular-nums text-muted-foreground">({data.areas.length})</span>
              </TabsTrigger>
              <TabsTrigger value="stores" className="gap-1.5">
                Stores
                <span className="text-xs tabular-nums text-muted-foreground">({data.stores.length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="areas" className="mt-0">
              <AreasPanel data={data} />
            </TabsContent>
            <TabsContent value="stores" className="mt-0">
              <StoresPanel data={data} onShowAreas={() => setTab("areas")} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
