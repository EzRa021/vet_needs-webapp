"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { create } from "zustand"

import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/stores/authStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { orderRef, statusMeta } from "@/lib/order-status"

// What the customer's pages are allowed to take from a realtime row. The
// event carries the whole row; only the fields the order pages show are
// merged into their caches.
const VISIBLE_FIELDS = ["status", "paid_at", "tracking_number", "updated_at"]

export const useCustomerOrderLive = create((set) => ({
  connection: "idle",
  changed: {}, // order id → timestamp of the last live change, for highlights
  setConnection: (connection) => set({ connection }),
  markChanged: (id) => set((s) => ({ changed: { ...s.changed, [id]: Date.now() } })),
}))

// Live order status for a signed-in customer. Mounted on the account pages and
// the checkout success page. postgres_changes applies RLS, so this receives
// only what "users read own orders" (001) already allows: this customer's own
// orders. Guests have no session to subscribe with; their tracking page polls.
export default function CustomerOrderRealtime() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: user } = useUser()
  const userId = user?.id
  const toastRef = useRef(toast)
  toastRef.current = toast

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const store = useCustomerOrderLive.getState

    const previousStatus = (id) =>
      qc.getQueryData(["my-orders"])?.find?.((o) => o.id === id)?.status ??
      qc.getQueryData(["order", id])?.status

    const onUpdate = ({ new: row }) => {
      if (!row?.id) return
      const before = previousStatus(row.id)
      const patch = Object.fromEntries(VISIBLE_FIELDS.map((k) => [k, row[k]]))

      // Patch first so the page changes instantly, then refetch to be sure.
      qc.setQueryData(["my-orders"], (list) =>
        Array.isArray(list) ? list.map((o) => (o.id === row.id ? { ...o, ...patch } : o)) : list
      )
      qc.setQueryData(["order", row.id], (order) => (order ? { ...order, ...patch } : order))
      qc.invalidateQueries({ queryKey: ["my-orders"] })
      qc.invalidateQueries({ queryKey: ["order", row.id] })
      store().markChanged(row.id)

      if (before && before !== row.status) {
        const meta = statusMeta(row.status)
        toastRef.current({
          title: `Order ${orderRef(row.id)}: ${meta.label}`,
          description: meta.customerUpdate,
        })
      }
    }

    const onInsert = () => qc.invalidateQueries({ queryKey: ["my-orders"] })

    store().setConnection("connecting")
    let catchUp = null
    const resync = () => {
      qc.invalidateQueries({ queryKey: ["my-orders"] })
      qc.invalidateQueries({ queryKey: ["order"] })
    }
    const channel = supabase
      // Unique per mount: see the note in components/admin/order-realtime.jsx.
      .channel(`orders:customer:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        onUpdate
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        onInsert
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          store().setConnection("live")
          // Catch up on anything that changed while disconnected, and again
          // once the server has finished registering the subscription (a
          // change in the first few seconds after SUBSCRIBED sends no event).
          resync()
          clearTimeout(catchUp)
          catchUp = setTimeout(resync, 4000)
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          store().setConnection("reconnecting")
        } else if (status === "CLOSED") {
          store().setConnection("idle")
        }
      })

    return () => {
      clearTimeout(catchUp)
      supabase.removeChannel(channel)
      store().setConnection("idle")
    }
  }, [userId, qc])

  return null
}

// "Live updates" chip for customer pages. Only claims to be live when it is.
export function CustomerLiveChip({ className }) {
  const connection = useCustomerOrderLive((s) => s.connection)
  const live = connection === "live"
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground print:hidden",
        className
      )}
    >
      <span className="relative flex size-2">
        {live && (
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", live ? "bg-success" : "bg-muted-foreground/50")} />
      </span>
      {live ? "Live updates on" : "Connecting to live updates"}
    </span>
  )
}
