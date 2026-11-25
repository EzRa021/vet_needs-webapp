import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

// False during the server render AND the browser's first (hydrating) render;
// true on every render after that.
//
// For data the browser may already hold before a component hydrates. The
// header and the home page share the ['taxonomy'] query: the header hydrates
// first and starts the fetch, and when the home page hydrates a moment later
// the departments are already in the cache — so its first browser render
// showed links where the server's HTML had loading placeholders, and React
// threw "Hydration failed because the server rendered HTML didn't match the
// client". Treat "not hydrated yet" as "still loading" and the two match;
// the real content follows one render later.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
