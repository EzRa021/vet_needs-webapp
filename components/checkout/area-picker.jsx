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
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// The checkout's area choice (028). Searchable, because Ibadan alone has ~50
// areas and people know theirs by name — scrolling a select for "Oluyole" is
// how a customer ends up picking the wrong one.
//
// Value is an area key (see parseAreaKey in lib/delivery.js):
//   "area:<id>"  a listed area
//   "city:<C>"   "my area in <C> isn't listed" (only if the city has a fallback price)
//   "state"      somewhere else in the state, priced by state
//
// cities: [{ city, state, hasFallback, areas: [{ id, name, aliases }] }] —
// already filtered to the chosen state.
export function describeAreaKey(key, cities, state) {
  if (!key) return null
  if (key === "state") return `Somewhere else in ${state}`
  if (key.startsWith("city:")) return `Not listed — ${key.slice(5)}`
  const id = key.slice(5)
  for (const c of cities) {
    const area = c.areas.find((a) => a.id === id)
    if (area) return cities.length > 1 ? `${area.name}, ${c.city}` : area.name
  }
  return null
}

export default function AreaPicker({ id, value, onChange, cities, state, invalid }) {
  const [open, setOpen] = useState(false)
  const label = describeAreaKey(value, cities, state)

  const choose = (key) => {
    onChange(key)
    setOpen(false)
  }

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
            "h-10 w-full justify-between px-3 font-normal",
            !label && "text-muted-foreground",
            invalid && "border-destructive"
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{label || "Search for your area"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type your area, e.g. Bodija" />
          <CommandList>
            <CommandEmpty>
              No area by that name. Choose an option below.
            </CommandEmpty>
            {cities.map((c) => (
              <CommandGroup key={`${c.city}|${c.state}`} heading={c.city}>
                {c.areas.map((area) => {
                  const key = `area:${area.id}`
                  return (
                    <CommandItem
                      key={area.id}
                      value={`${area.name}|${c.city}`}
                      keywords={[area.name, c.city, ...(area.aliases || [])]}
                      onSelect={() => choose(key)}
                    >
                      <Check
                        className={cn("size-4", value === key ? "opacity-100" : "opacity-0")}
                        aria-hidden="true"
                      />
                      <span className="flex-1">{area.name}</span>
                      {area.aliases?.length > 0 && (
                        <span className="truncate text-xs text-muted-foreground">
                          {area.aliases.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
            <CommandSeparator />
            {/* Always reachable, whatever was typed: a customer whose area
                isn't listed must never be stuck. forceMount keeps these out of
                the search filter. */}
            <CommandGroup heading="Can't find it?" forceMount>
              {cities
                .filter((c) => c.hasFallback)
                .map((c) => {
                  const key = `city:${c.city}`
                  return (
                    <CommandItem
                      key={key}
                      value={`not-listed|${c.city}`}
                      forceMount
                      onSelect={() => choose(key)}
                    >
                      <Check
                        className={cn("size-4", value === key ? "opacity-100" : "opacity-0")}
                        aria-hidden="true"
                      />
                      My area in {c.city} isn&apos;t listed
                    </CommandItem>
                  )
                })}
              <CommandItem value="outside-city" forceMount onSelect={() => choose("state")}>
                <Check
                  className={cn("size-4", value === "state" ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                Somewhere else in {state} (outside {cities.map((c) => c.city).join(" and ")})
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
