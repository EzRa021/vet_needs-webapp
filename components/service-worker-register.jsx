"use client"

import { useEffect } from "react"

// Registers /sw.js so the shop is installable.
//
// Production only: a service worker in dev fights Turbopack's HMR (it caches the
// dev shell and you end up debugging the SW instead of your change). The SW
// itself caches nothing dynamic, so there's no staleness to worry about — this
// guard is purely about the dev experience.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // A failed SW registration must never surface to the shopper — the site
        // works without it; it just isn't installable.
        console.error("Service worker registration failed:", err)
      })

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register)
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
