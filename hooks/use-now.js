"use client"

import { useEffect, useState } from "react"

// Re-renders every `intervalMs` so "4 min ago" keeps counting without a
// refetch. One timer per component that asks — keep it at page level.
export function useNow(intervalMs = 30 * 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
