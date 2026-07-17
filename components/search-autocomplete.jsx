"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, Loader2, FolderTree, CornerDownLeft } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import BrandImage from "@/components/brand-image"
import { formatUnitPrice } from "@/lib/pricing"
import { cn } from "@/lib/utils"

const useSuggestions = (q) =>
  useQuery({
    queryKey: ["search-suggest", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/shop/search-suggest?q=${encodeURIComponent(q.trim())}`)
      if (!res.ok) throw new Error("Failed to load suggestions")
      return (await res.json()).data
    },
    staleTime: 60 * 1000,
    // Keep the old list on screen while the next one loads: clearing it makes
    // the panel flicker on every keystroke.
    placeholderData: (prev) => prev,
  })

export default function SearchAutocomplete({
  placeholder = "Search feed, pet food, accessories…",
  className,
  inputClassName,
  onNavigate,
  showButton = true,
}) {
  const router = useRouter()
  const listId = useId()
  const rootRef = useRef(null)

  const [value, setValue] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  // -1 = nothing highlighted, so Enter submits the typed text rather than
  // silently picking whatever happens to be first.
  const [active, setActive] = useState(-1)

  // Debounce: a request per keystroke would be ~8 for "layer mash".
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 250)
    return () => clearTimeout(t)
  }, [value])

  const { data, isFetching } = useSuggestions(debounced)
  const items = data?.items || []
  const categories = data?.categories || []

  // One flat list so arrow keys can cross the products/categories boundary
  // without the user knowing there is one.
  const options = [
    ...categories.map((c) => ({
      kind: "category",
      id: c.id,
      label: c.name,
      href: `/shop/category/${c.id}`,
      image: c.image_url,
    })),
    ...items.map((i) => ({
      kind: "item",
      id: i.id,
      label: i.name,
      href: `/product/${i.id}`,
      image: i.image_url,
      price: i.price,
      unit_type: i.unit_type,
      category: i.category_name,
    })),
  ]

  const showPanel = open && debounced.trim().length >= 2

  // Reset the highlight whenever the list changes underneath it — otherwise
  // index 3 might point at a different product than the one that was outlined.
  useEffect(() => setActive(-1), [debounced])

  // Click outside closes. Pointerdown, not click, so it fires before the input
  // blur reorders things.
  useEffect(() => {
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  const go = (href) => {
    setOpen(false)
    setValue("")
    onNavigate?.()
    router.push(href)
  }

  const submitSearch = () => {
    const q = value.trim()
    if (!q) return
    setOpen(false)
    onNavigate?.()
    router.push(`/shop?search=${encodeURIComponent(q)}`)
  }

  const handleKeyDown = (e) => {
    if (!showPanel || options.length === 0) {
      if (e.key === "Escape") setOpen(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      // Only intercept when something is actually highlighted; otherwise let
      // the form submit a normal keyword search.
      if (active >= 0) {
        e.preventDefault()
        go(options[active].href)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitSearch()
        }}
      >
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-opt-${active}` : undefined
            }
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={cn("h-12 w-full rounded-full pl-11", showButton ? "pr-28" : "pr-11", inputClassName)}
          />
          {isFetching && debounced.trim().length >= 2 && (
            <Loader2
              className={cn(
                "absolute top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground",
                showButton ? "right-28" : "right-4"
              )}
            />
          )}
          {showButton && (
            <Button
              type="submit"
              className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full px-5"
            >
              Search
            </Button>
          )}
        </div>
      </form>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-lg"
        >
          {options.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? "Searching…" : `No matches for “${debounced.trim()}”`}
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {options.map((opt, i) => (
                <li
                  key={`${opt.kind}-${opt.id}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  // Mouse and keyboard share one highlight, so hovering then
                  // pressing Enter does what it looks like it will.
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(opt.href)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2",
                    active === i && "bg-accent"
                  )}
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {opt.kind === "category" && !opt.image ? (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <FolderTree className="size-4" />
                      </div>
                    ) : (
                      <BrandImage
                        src={opt.image}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                        placeholderLabel={opt.label}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{opt.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {opt.kind === "category" ? "Category" : opt.category || "Product"}
                    </p>
                  </div>

                  {opt.kind === "item" && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                      {formatUnitPrice(opt.price, opt.unit_type)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={submitSearch}
            className="flex w-full items-center justify-between gap-2 border-t px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>
              See all results for{" "}
              <span className="font-medium text-foreground">“{debounced.trim()}”</span>
            </span>
            <CornerDownLeft className="size-3.5 shrink-0" />
          </button>
        </div>
      )}
    </div>
  )
}
