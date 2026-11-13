"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/relative-time"
import { useOrderLiveStore } from "@/stores/orderLiveStore"
import { useStockLiveStore } from "@/stores/stockLiveStore"

const STATES = {
  live: {
    label: "Live",
    dot: "bg-success",
    help: "Changes appear here the moment they happen.",
  },
  connecting: {
    label: "Connecting",
    dot: "bg-earth",
    help: "Opening the live connection.",
  },
  idle: {
    label: "Connecting",
    dot: "bg-earth",
    help: "Opening the live connection.",
  },
  reconnecting: {
    label: "Reconnecting",
    dot: "bg-earth",
    help: "The live connection dropped. This page still refreshes every 30 seconds until it's back.",
  },
  offline: {
    label: "Offline",
    dot: "bg-destructive",
    help: "No connection. This page refreshes when you're back online.",
  },
}

// The page's heartbeat: a dot that breathes while the socket is open.
// source: "orders" (orders listener) or "stock" (item_history listener).
export default function LiveIndicator({ now, className, source = "orders" }) {
  const useStore = source === "stock" ? useStockLiveStore : useOrderLiveStore
  const connection = useStore((s) => s.connection)
  const lastEventAt = useStore((s) => s.lastEventAt)
  const state = STATES[connection] || STATES.connecting
  const live = connection === "live"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-live="polite"
          tabIndex={0}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <span className="relative flex size-2">
            {live && (
              <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
            )}
            <span className={cn("relative inline-flex size-2 rounded-full", state.dot)} />
          </span>
          {state.label}
          {live && lastEventAt && (
            <span className="hidden font-normal text-muted-foreground sm:inline">
              last change {timeAgo(lastEventAt, now)}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px]">
        {state.help}
      </TooltipContent>
    </Tooltip>
  )
}
