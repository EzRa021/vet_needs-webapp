"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { useAdminAnnounce } from "@/components/admin/use-admin-announce"
import { createClient } from "@/lib/supabase/client"
import { formatQuantity } from "@/lib/units"
import { orderRef } from "@/lib/order-status"
import { STOCK_TYPES } from "@/lib/stock-movements"
import { useOrderLiveStore } from "@/stores/orderLiveStore"
import { useStockLiveStore } from "@/stores/stockLiveStore"

// Live stock for the whole admin, mounted in the admin layout beside the
// orders listener. It subscribes to item_history (staff-only, see 025) —
// every sale, restock, adjustment and price change writes a row there — and:
//   · refreshes the Products, Inventory and product pages
//   · warns staff the moment a product drops to its reorder point or runs out
//
// Rows carry the before/after stock but not the product's name or reorder
// point, so those come from whatever product data is already cached, and only
// failing that from the API.

function findCached(qc, id) {
  const single = qc.getQueryData(["admin", "product", id])
  if (single) return single
  for (const [, data] of qc.getQueriesData({ queryKey: ["admin", "products"] })) {
    const hit = data?.data?.find?.((p) => p.id === id)
    if (hit) return hit
  }
  const row = qc.getQueryData(["admin", "inventory"])?.rows?.find?.((r) => r.id === id)
  return row ? { ...row, low_stock_threshold: row.threshold } : null
}

async function lookupItem(qc, id) {
  const cached = findCached(qc, id)
  if (cached?.name) return cached
  try {
    const res = await fetch(`/api/admin/products/${id}`)
    if (!res.ok) return null
    return (await res.json()).data
  } catch {
    return null
  }
}

export default function AdminStockRealtime() {
  const qc = useQueryClient()
  const pathname = usePathname()
  const announce = useAdminAnnounce()
  const unseen = useStockLiveStore((s) => s.unseen)
  const clearUnseen = useStockLiveStore((s) => s.clearUnseen)

  useEffect(() => {
    if (pathname === "/admin/inventory") clearUnseen()
  }, [pathname, unseen, clearUnseen])

  useEffect(() => {
    const supabase = createClient()
    const store = useStockLiveStore.getState
    let refreshTimer = null
    let wasDisconnected = false
    const touched = new Set()

    // A paid order with five products writes five rows in one go; refetch the
    // lists once, and each touched product's own page once.
    const refresh = (itemId) => {
      if (itemId) touched.add(itemId)
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin", "products"] })
        qc.invalidateQueries({ queryKey: ["admin", "inventory"] })
        qc.invalidateQueries({ queryKey: ["admin", "stats"] })
        for (const id of touched) {
          qc.invalidateQueries({ queryKey: ["admin", "product", id] })
          qc.invalidateQueries({ queryKey: ["admin", "item-history", id] })
        }
        touched.clear()
      }, 300)
    }

    const warnIfCrossed = async (row) => {
      const d = row.details || {}
      const before = Number(d.previousValue)
      const after = Number(d.newValue)
      // Only a fall can cross a reorder point.
      if (!Number.isFinite(before) || !Number.isFinite(after) || after >= before) return
      if (!useOrderLiveStore.getState().prefs.onLowStock) return

      const item = await lookupItem(qc, row.item_id)
      const threshold = Number(item?.low_stock_threshold ?? 10)
      const ranOut = before > 0 && after <= 0
      const wentLow = !ranOut && after > 0 && before > threshold && after <= threshold
      if (!ranOut && !wentLow) return

      const name = item?.name || "A product"
      const unit = d.unitType || item?.unit_type
      const cause =
        row.type === "sale" && d.orderId ? ` after order ${orderRef(d.orderId)}` : ""

      store().addUnseen()
      announce({
        key: `stock:${row.id}`,
        kind: "stock",
        title: ranOut ? `${name} is out of stock` : `${name} is running low`,
        body: ranOut
          ? item?.allow_backorder
            ? `Stock hit 0${cause}. Backorders are on, so customers can still buy it.`
            : `Stock hit 0${cause}. It can't be bought until you restock.`
          : `${formatQuantity(after, unit)} left${cause}. Reorder point is ${formatQuantity(threshold, unit)}.`,
        url: `/admin/products/${row.item_id}`,
        actionLabel: "View product",
      })
    }

    const onInsert = ({ new: row }) => {
      if (!row?.item_id) return
      refresh(row.item_id)
      const isStock = STOCK_TYPES.includes(row.type)
      store().markFresh(
        row.item_id,
        row.type,
        isStock ? Number(row.details?.changeAmount ?? 0) : null
      )
      if (isStock) warnIfCrossed(row)
    }

    store().setConnection("connecting")

    // Fresh topic per mount — see the note in order-realtime.jsx.
    const channel = supabase
      .channel(`admin:stock:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "item_history" }, onInsert)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          store().setConnection("live")
          if (wasDisconnected) refresh()
          wasDisconnected = false
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          wasDisconnected = true
          store().setConnection("reconnecting")
        } else if (status === "CLOSED") {
          store().setConnection("offline")
        }
      })

    const onOffline = () => {
      wasDisconnected = true
      store().setConnection("offline")
    }
    const onOnline = () => {
      refresh()
      setTimeout(() => {
        if (channel.state === "joined") store().setConnection("live")
      }, 3000)
    }
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)

    return () => {
      clearTimeout(refreshTimer)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
      supabase.removeChannel(channel)
      store().setConnection("idle")
    }
  }, [qc, announce])

  return null
}
