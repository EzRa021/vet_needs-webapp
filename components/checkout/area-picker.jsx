"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatNaira } from "@/lib/pricing"
import { cn } from "@/lib/utils"

// The checkout's area choice (029, 031). In a fixed-price state the area is
// what prices door delivery and decides which store a pickup comes from.
// Searchable: Ibadan has ~50 areas and people know theirs by name, and
// scrolling a select for "Oluyole" is how someone picks the wrong one.
//
// areas:      [{ id, name, aliases, city, deliveryFee, storeId }] — already
//             filtered to the chosen state; grouped here by city
// stores:     [{ id, name }] — to name an area's pickup store
// method:     'delivery' or 'pickup'
// showPrices: each area's price beside it (fixed-price states only); for
//             pickup, its store is shown instead
export default function AreaPicker({ id, value, onChange, areas, stores, method, showPrices = true, invalid }) {
  const [open, setOpen] = useState(false)
  const chosen = areas.find((a) => a.id === value) || null
  const storeName = (storeId) => stores.find((s) => s.id === storeId)?.name || null

  const choose = (areaId) => {
    onChange(areaId)
    setOpen(false)
  }

  // What the customer gets in that area, right beside its name, so the
  // choice and its consequence are read together.
  const detail = (area) => {
    if (method === "pickup") return storeName(area.storeId)
    if (!showPrices) return null
    return area.deliveryFee === null ? "Pickup only" : formatNaira(area.deliveryFee)
  }

  // One group per city, in name order ("Ibadan", or "Ikeja" and "Lekki"…).
  const cities = [...new Set(areas.map((a) => a.city || ""))].sort((a, b) => a.localeCompare(b))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-11 w-full justify-between px-3 font-normal",
            !chosen && "text-muted-foreground",
            invalid && "border-destructive"
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{chosen ? chosen.name : "Search for your area"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type your area" />
          <CommandList>
            <CommandEmpty>No area by that name. Choose the one nearest to you.</CommandEmpty>
            {cities.map((city) => (
              <CommandGroup key={city} heading={city || undefined}>
                {areas
                  .filter((area) => (area.city || "") === city)
                  .map((area) => {
                    const info = detail(area)
                    return (
                      <CommandItem
                        key={area.id}
                        value={`${area.name}|${city}`}
                        keywords={[area.name, city, ...(area.aliases || [])]}
                        onSelect={() => choose(area.id)}
                        className="min-h-11"
                      >
                        <Check
                          className={cn("size-4", value === area.id ? "opacity-100" : "opacity-0")}
                          aria-hidden="true"
                        />
                        <span className="flex-1">{area.name}</span>
                        {info && (
                          <span
                            className={cn(
                              "text-xs text-muted-foreground",
                              method === "delivery" && area.deliveryFee !== null && "tabular-nums"
                            )}
                          >
                            {info}
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
