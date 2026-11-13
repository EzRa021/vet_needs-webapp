"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { useAdminAnnounce } from "@/components/admin/use-admin-announce"
import { createClient } from "@/lib/supabase/client"
import { formatNaira } from "@/lib/pricing"
import { orderRef, parseShippingAddress } from "@/lib/order-status"
import { unlockAudio } from "@/lib/order-alerts"
import { useOrderLiveStore } from "@/stores/orderLiveStore"

// A payment counts as "just happened" if paid_at is this recent. Later edits
// to a paid order (a tracking number, a note) fire UPDATEs too, and must not
// announce the payment again.
const PAYMENT_FRESH_MS = 10 * 60 * 1000

const customerName = (order) =>
  parseShippingAddress(order.shipping_address).name || order.email || "A customer"

// One realtime subscription for the whole admin area, mounted in the admin
// layout. It doesn't render anything: it keeps React Query in sync with the
// database and raises the alerts. Staff hear about a new order on any admin
// page, not just Orders.
//
// RLS applies to postgres_changes, so this only ever receives what
// "staff read all orders" (003) already lets this user read.
export default function AdminOrderRealtime() {
  const qc = useQueryClient()
  const pathname = usePathname()
  const announce = useAdminAnnounce()

  const unseen = useOrderLiveStore((s) => s.unseen)
  const clearUnseen = useOrderLiveStore((s) => s.clearUnseen)

  // Looking at the Orders page counts as having seen the new orders.
  useEffect(() => {
    if (pathname === "/admin/orders") clearUnseen()
  }, [pathname, unseen, clearUnseen])

  // Preferences live in localStorage, so they can only load in the browser.
  // Audio unlocks on the first click or key press anywhere.
  useEffect(() => {
    useOrderLiveStore.getState().loadPrefs()
    const unlock = () => unlockAudio()
    window.addEventListener("pointerdown", unlock, { passive: true })
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const store = useOrderLiveStore.getState
    let wasDisconnected = false
    let refreshTimer = null
    let onlineCheck = null
    let catchUp = null

    // Coalesce bursts (payment confirmation writes the row more than once)
    // into one refetch of whatever order queries are on screen.
    const refresh = (id) => {
      if (id) qc.invalidateQueries({ queryKey: ["admin", "order", id] })
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] })
        qc.invalidateQueries({ queryKey: ["admin", "stats"] })
      }, 250)
    }

    const onInsert = ({ new: order }) => {
      if (!order?.id) return
      const s = store()
      s.markFresh(order.id, "new")
      s.addArrival(order.id)
      refresh(order.id)

      if (!s.prefs.onNewOrder) return
      announce({
        key: `${order.id}:new`,
        kind: "order",
        title: `New order ${orderRef(order.id)}`,
        body: `${customerName(order)} placed an order for ${formatNaira(order.total_amount)}. Waiting for payment.`,
        url: `/admin/orders/${order.id}`,
      })
    }

    const onUpdate = ({ new: order }) => {
      if (!order?.id) return
      const s = store()
      refresh(order.id)

      const paidAt = order.paid_at ? new Date(order.paid_at).getTime() : 0
      const justPaid = order.status === "paid" && paidAt && Date.now() - paidAt < PAYMENT_FRESH_MS

      if (!justPaid) {
        s.markFresh(order.id, "updated")
        return
      }

      s.markFresh(order.id, "paid")
      if (!s.prefs.onPayment) return
      announce({
        key: `${order.id}:paid`,
        kind: "payment",
        title: `Payment received for ${orderRef(order.id)}`,
        body: `${customerName(order)} paid ${formatNaira(order.total_amount)}. Ready to pack.`,
        url: `/admin/orders/${order.id}`,
      })
    }

    store().setConnection("connecting")

    // A fresh topic per mount. realtime-js hands back an existing channel when
    // the topic matches, and removeChannel() finishes asynchronously — so a
    // quick remount (React dev's double effect, a fast navigation) would get
    // the channel that's still closing and never subscribe.
    const channel = supabase
      .channel(`admin:orders:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, onInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, onUpdate)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          store().setConnection("live")
          // The server finishes registering the subscription a moment after
          // SUBSCRIBED (1–4 s, measured on the local stack); a change in that
          // gap arrives as no event. One catch-up refetch after it closes the
          // gap, on first connect and on every reconnect.
          clearTimeout(catchUp)
          catchUp = setTimeout(() => refresh(), 4000)
          // Anything that happened while the socket was down was missed —
          // refetch rather than trust the stale page.
          if (wasDisconnected) refresh()
          wasDisconnected = false
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          wasDisconnected = true
          store().setConnection("reconnecting")
        } else if (status === "CLOSED") {
          store().setConnection("offline")
        }
      })

    // The socket can't notice a dead network on its own for a while; the
    // browser can. Coming back online forces a resync.
    const onOffline = () => {
      wasDisconnected = true
      store().setConnection("offline")
    }
    const onOnline = () => {
      store().setConnection("reconnecting")
      refresh()
      // If the socket survived the blip it won't re-announce SUBSCRIBED, so
      // read its state rather than waiting for an event that never comes.
      clearTimeout(onlineCheck)
      onlineCheck = setTimeout(() => {
        if (channel.state === "joined") store().setConnection("live")
      }, 3000)
    }
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)

    return () => {
      clearTimeout(refreshTimer)
      clearTimeout(onlineCheck)
      clearTimeout(catchUp)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
      supabase.removeChannel(channel)
      store().setConnection("idle")
    }
  }, [qc, announce])

  return null
}
