"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { formatNaira } from "@/lib/pricing"

export const useFacets = ({ category, department, search }) =>
  useQuery({
    queryKey: ["facets", category, department, search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (category && category !== "all") params.set("category", category)
      if (department && department !== "all") params.set("department", department)
      if (search) params.set("search", search)
      const res = await fetch(`/api/shop/facets?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load filters")
      return (await res.json()).data
    },
    staleTime: 60 * 1000,
  })

// "bag_size" → "Bag size". The keys are authored by staff in the product form,
// so they're snake_case rather than display text.
const humanise = (key) =>
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

function PriceFilter({ bounds, value, onCommit }) {
  // Local state while dragging: committing per pixel would fire a query per
  // frame. The URL only changes on release.
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value[0], value[1]])

  if (bounds.max <= bounds.min) return null

  return (
    <div className="space-y-3 px-1 pt-2">
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={100}
        value={local}
        onValueChange={setLocal}
        onValueCommit={onCommit}
        aria-label="Price range"
      />
      <div className="flex items-center justify-between text-sm tabular-nums">
        <span>{formatNaira(local[0])}</span>
        <span className="text-muted-foreground">{formatNaira(local[1])}</span>
      </div>
    </div>
  )
}

// The shop's filter panel. Every control is driven by facets computed over the
// current result set (013), so it never offers a filter that matches nothing.
export default function ShopFacets({
  facets,
  isLoading,
  selected,
  onChange,
  onClear,
  hasActive,
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!facets) return null

  const { price, brands = [], attributes = [], in_stock: inStockCount, total } = facets

  const priceBounds = [Number(price?.min) || 0, Number(price?.max) || 0]
  const priceValue = [
    selected.minPrice ?? priceBounds[0],
    selected.maxPrice ?? priceBounds[1],
  ]

  const showPrice = priceBounds[1] > priceBounds[0]
  const showStock = inStockCount > 0 && inStockCount < total

  // Nothing worth showing — every facet was single-valued or empty. Rendering
  // an empty "Filters" panel would just be furniture.
  if (!showPrice && brands.length === 0 && attributes.length === 0 && !showStock) {
    return null
  }

  const defaultOpen = [
    showPrice && "price",
    brands.length > 0 && "brand",
    ...attributes.slice(0, 2).map((a) => `attr-${a.key}`),
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Filters</h3>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>

      {showStock && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="facet-instock"
            checked={selected.inStock === true}
            onCheckedChange={(v) => onChange({ inStock: v ? "true" : null })}
          />
          <Label htmlFor="facet-instock" className="text-sm font-normal">
            In stock only{" "}
            <span className="text-muted-foreground">({inStockCount})</span>
          </Label>
        </div>
      )}

      <Accordion type="multiple" defaultValue={defaultOpen}>
        {showPrice && (
          <AccordionItem value="price">
            <AccordionTrigger className="text-sm">Price</AccordionTrigger>
            <AccordionContent>
              <PriceFilter
                bounds={{ min: priceBounds[0], max: priceBounds[1] }}
                value={priceValue}
                onCommit={([lo, hi]) =>
                  onChange({
                    // Omit a bound that's back at the extreme — it isn't a
                    // filter, and it keeps the URL clean and shareable.
                    minPrice: lo > priceBounds[0] ? String(lo) : null,
                    maxPrice: hi < priceBounds[1] ? String(hi) : null,
                  })
                }
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {brands.length > 0 && (
          <AccordionItem value="brand">
            <AccordionTrigger className="text-sm">Brand</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 px-1">
                {brands.map((b) => (
                  <div key={b.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`brand-${b.value}`}
                      checked={selected.brands.includes(b.value)}
                      onCheckedChange={(checked) =>
                        onChange({
                          brand: checked
                            ? [...selected.brands, b.value]
                            : selected.brands.filter((x) => x !== b.value),
                        })
                      }
                    />
                    <Label
                      htmlFor={`brand-${b.value}`}
                      className="flex-1 text-sm font-normal"
                    >
                      {b.value}{" "}
                      <span className="text-muted-foreground">({b.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {attributes.map((attr) => (
          <AccordionItem key={attr.key} value={`attr-${attr.key}`}>
            <AccordionTrigger className="text-sm">{humanise(attr.key)}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 px-1">
                {attr.values.map((v) => {
                  const active = selected.attrs[attr.key] === v.value
                  return (
                    <div key={v.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`attr-${attr.key}-${v.value}`}
                        checked={active}
                        // One value per key: attributes->>key = X AND = Y can
                        // never match, so a second tick replaces rather than adds.
                        onCheckedChange={(checked) =>
                          onChange({ attr: { key: attr.key, value: checked ? v.value : null } })
                        }
                      />
                      <Label
                        htmlFor={`attr-${attr.key}-${v.value}`}
                        className="flex-1 text-sm font-normal"
                      >
                        {v.value}{" "}
                        <span className="text-muted-foreground">({v.count})</span>
                      </Label>
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
