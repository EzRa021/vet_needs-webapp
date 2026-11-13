"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { claimAlert, playChime, showDesktopNotification } from "@/lib/order-alerts"
import { useOrderLiveStore } from "@/stores/orderLiveStore"

// A hidden tab waits this long before claiming an alert, so a tab the person
// is actually looking at gets to play the chime first.
const HIDDEN_TAB_DELAY_MS = 400

const TITLE_COUNT = /^\(\d+\)\s*/

// One way to tell staff something happened, shared by the order and stock
// listeners so every alert behaves the same:
//   · chime (once across all admin tabs) if sound is on
//   · desktop notification if the tab isn't in front
//   · in-app toast with an Open button, always
//   · "(n)" in the tab title while the tab is in the background
//
// announce({ key, kind, title, body, url, actionLabel })
//   key   unique per event; the cross-tab de-duplication key
//   kind  'order' | 'payment' | 'stock' (picks the chime)
export function useAdminAnnounce() {
  const router = useRouter()
  const { toast } = useToast()
  const routerRef = useRef(router)
  const toastRef = useRef(toast)
  routerRef.current = router
  toastRef.current = toast

  // Clear the "(n)" once the tab is back in front.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.title = document.title.replace(TITLE_COUNT, "")
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  return useCallback(async ({ key, kind, title, body, url, actionLabel = "Open" }) => {
    const visible = document.visibilityState === "visible" && document.hasFocus()
    if (!visible) await new Promise((r) => setTimeout(r, HIDDEN_TAB_DELAY_MS))

    const { prefs } = useOrderLiveStore.getState()
    const claimed = await claimAlert(key)

    if (claimed) {
      if (prefs.sound) playChime(kind, prefs.volume)
      if (prefs.desktop && !visible) {
        showDesktopNotification({
          title,
          body,
          tag: key,
          url,
          onClick: () => routerRef.current.push(url),
        })
      }
    }

    if (document.visibilityState !== "visible") {
      const match = document.title.match(/^\((\d+)\)\s*/)
      const count = match ? Number(match[1]) + 1 : 1
      document.title = `(${count}) ${document.title.replace(TITLE_COUNT, "")}`
    }

    toastRef.current({
      title,
      description: body,
      variant: kind === "stock" ? "default" : undefined,
      action: (
        <ToastAction altText={actionLabel} onClick={() => routerRef.current.push(url)}>
          {actionLabel}
        </ToastAction>
      ),
    })
  }, [])
}
