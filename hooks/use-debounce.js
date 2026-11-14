"use client"

import { useEffect, useState } from "react"

// The value, but only after it has stopped changing for `delay` ms. Keeps a
// query from firing on every keystroke.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
