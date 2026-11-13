import { create } from 'zustand'

// Live stock state, fed by components/admin/stock-realtime.jsx and read by
// the Products and Inventory pages, the product page and the sidebar badge.
//
//   connection  idle → connecting → live; reconnecting/offline when it drops
//   fresh       item id → { kind, change, at }: rows to highlight because their
//               stock or price just moved
//   unseen      low / out-of-stock alerts since staff last opened Inventory
const FRESH_TTL_MS = 2 * 60 * 1000

export const useStockLiveStore = create((set, get) => ({
  connection: 'idle',
  lastEventAt: null,
  fresh: {},
  unseen: 0,

  setConnection: (connection) => set({ connection }),

  markFresh: (id, kind, change = null) =>
    set((s) => {
      const now = Date.now()
      const fresh = {}
      for (const [key, value] of Object.entries(s.fresh)) {
        if (now - value.at < FRESH_TTL_MS) fresh[key] = value
      }
      fresh[id] = { kind, change, at: now }
      return { fresh, lastEventAt: now }
    }),

  addUnseen: () => set((s) => ({ unseen: s.unseen + 1 })),
  clearUnseen: () => (get().unseen ? set({ unseen: 0 }) : undefined),
}))
