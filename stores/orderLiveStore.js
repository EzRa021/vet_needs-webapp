import { create } from 'zustand'
import { DEFAULT_ALERT_PREFS, loadAlertPrefs, saveAlertPrefs } from '@/lib/order-alerts'

// Shared state for live orders, fed by components/admin/order-realtime.jsx
// (one subscription for the whole admin) and read by the Orders page, the
// sidebar badge and the alert settings.
//
//   connection  idle → connecting → live; reconnecting/offline when the socket drops
//   fresh       id → { kind, at } for rows that just changed, so the table can
//               highlight them ('new' | 'paid' | 'updated')
//   arrivals    orders that arrived over the socket, newest first — the Orders
//               page uses these to say "2 new orders" when they're not on screen
//   unseen      new orders since staff last looked at the Orders page
const FRESH_TTL_MS = 2 * 60 * 1000
const MAX_ARRIVALS = 50

export const useOrderLiveStore = create((set, get) => ({
  connection: 'idle',
  lastEventAt: null,
  lastSyncedAt: null,
  fresh: {},
  arrivals: [],
  unseen: 0,
  prefs: DEFAULT_ALERT_PREFS,
  prefsLoaded: false,

  setConnection: (connection) =>
    set((s) => ({
      connection,
      lastSyncedAt: connection === 'live' ? Date.now() : s.lastSyncedAt,
    })),

  markFresh: (id, kind) =>
    set((s) => {
      const now = Date.now()
      const fresh = {}
      for (const [key, value] of Object.entries(s.fresh)) {
        if (now - value.at < FRESH_TTL_MS) fresh[key] = value
      }
      fresh[id] = { kind, at: now }
      return { fresh, lastEventAt: now }
    }),

  addArrival: (id) =>
    set((s) => ({
      arrivals: [{ id, at: Date.now() }, ...s.arrivals.filter((a) => a.id !== id)].slice(0, MAX_ARRIVALS),
      unseen: s.unseen + 1,
    })),

  clearUnseen: () => (get().unseen ? set({ unseen: 0 }) : undefined),

  loadPrefs: () => set({ prefs: loadAlertPrefs(), prefsLoaded: true }),

  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch }
    saveAlertPrefs(prefs)
    set({ prefs })
  },
}))
