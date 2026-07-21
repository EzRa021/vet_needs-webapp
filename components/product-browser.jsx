"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import ProductCard from "@/components/product-card"
import ShopFacets, { useFacets } from "@/components/shop-facets"
import { RevealGroup, RevealItem } from "@/components/motion/reveal"
import { formatNaira } from "@/lib/pricing"
import {
  SHOP_DEFAULTS,
  useDepartments,
  useCategories,
  useItems,
} from "@/stores/shopStore"

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "created_at-desc", label: "Newest First" },
]

// Anything can be typed into a URL. Only these reach the API — which validates
// again server-side, but a junk ?sortBy= shouldn't produce a broken page here.
const SORT_KEYS = new Set(["name", "price", "created_at", "stock"])

// The whole product-browsing engine: search, filters, sort, grid, pagination.
// Shared so /shop and /shop/category/[id] cannot drift — the category page used
// to carry its own copy, which had quietly rotted into showing dollar prices.
//
// `lockedCategoryId` pins the browser to one category and hides the
// department/category pickers, since the page's own heading already says where
// the shopper is.
export default function ProductBrowser({ lockedCategoryId = null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const locked = !!lockedCategoryId

  // The URL is the single source of truth. Nothing to sync, nothing to reset on
  // unmount, and ?search= / ?category= links (the header search bar, and the
  // admin-authored promo banner link_url in 000_initial_schema.sql) work by
  // simply being read here.
  // Facet selections live in the URL alongside everything else, so a filtered
  // view is shareable and the back button steps through filtering.
  const attrs = {}
  for (const [k, v] of searchParams.entries()) {
    if (k.startsWith("attr.") && v) attrs[k.slice(5)] = v
  }
  const brands = searchParams.getAll("brand").filter(Boolean)
  const num = (key) => {
    const n = Number(searchParams.get(key))
    return Number.isFinite(n) && searchParams.get(key) !== null ? n : null
  }

  const filters = {
    ...SHOP_DEFAULTS,
    search: searchParams.get("search") || "",
    // On a category page the route IS the category, so it can't be overridden
    // by a stray query param.
    category: locked ? lockedCategoryId : searchParams.get("category") || "all",
    department: locked ? "all" : searchParams.get("department") || "all",
    sortBy: SORT_KEYS.has(searchParams.get("sortBy"))
      ? searchParams.get("sortBy")
      : SHOP_DEFAULTS.sortBy,
    sortOrder: searchParams.get("sortOrder") === "desc" ? "desc" : "asc",
    page: Math.max(parseInt(searchParams.get("page")) || 1, 1),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    inStock: searchParams.get("inStock") === "true",
    brands,
    attrs,
  }

  // Local mirror so typing doesn't rewrite the URL on every keystroke; the URL
  // is only touched on submit.
  const [searchInput, setSearchInput] = useState(filters.search)

  // Someone navigating back/forward, or arriving via a shared link, changes the
  // URL without touching the input — keep the box showing what's applied.
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  // Writes the URL. `replace` rather than `push` for filters: 12 tweaks
  // shouldn't mean 12 back-presses to leave the shop. Defaults are omitted so
  // shared links stay short and canonical.
  const setParams = (patch, { resetPage = true, scroll = false } = {}) => {
    const next = new URLSearchParams(searchParams.toString())

    const apply = (key, value) => {
      // `brand` repeats rather than replaces — ticking two brands is an OR.
      if (key === "brand") {
        next.delete("brand")
        ;(value || []).forEach((v) => next.append("brand", v))
        return
      }

      // `attr` patches one facet key at a time: { key, value }.
      if (key === "attr") {
        if (value?.value) next.set(`attr.${value.key}`, value.value)
        else next.delete(`attr.${value.key}`)
        return
      }

      const isDefault =
        value === undefined ||
        value === null ||
        value === "" ||
        value === "all" ||
        (key === "page" && Number(value) === 1) ||
        (key === "sortBy" && value === SHOP_DEFAULTS.sortBy) ||
        (key === "sortOrder" && value === SHOP_DEFAULTS.sortOrder)
      if (isDefault) next.delete(key)
      else next.set(key, String(value))
    }

    Object.entries(patch).forEach(([k, v]) => apply(k, v))
    // Any filter change invalidates the current page number — page 7 of the old
    // result set is meaningless against a new one, and often empty.
    if (resetPage && !("page" in patch)) next.delete("page")

    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll })
  }

  const { data: departments } = useDepartments()
  const { data: categories, isLoading: categoriesLoading } = useCategories(filters.department)
  const { data: itemsData, isLoading: itemsLoading } = useItems(filters)

  const items = itemsData?.data || []
  const pagination = itemsData?.pagination || { total: 0, page: 1, pages: 0 }

  const handleSearch = (e) => {
    e.preventDefault()
    setParams({ search: searchInput })
  }

  const activeFacetCount =
    filters.brands.length +
    Object.keys(filters.attrs).length +
    (filters.inStock ? 1 : 0) +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0)

  const hasFacetFilters = activeFacetCount > 0

  // A locked category isn't an "active filter" — it's the page itself, so
  // clearing it would strand the shopper on a category page showing everything.
  const hasActiveFilters =
    !!filters.search ||
    hasFacetFilters ||
    (!locked && (filters.department !== "all" || filters.category !== "all"))

  const clearAll = () => {
    setSearchInput("")
    // Facet keys are dynamic (attr.<whatever staff named it>), so they can't be
    // listed — drop every param and rebuild only what the page itself owns.
    router.replace(pathname, { scroll: false })
  }

  const clearFacets = () => {
    const next = new URLSearchParams(searchParams.toString())
    for (const key of [...next.keys()]) {
      if (key.startsWith("attr.") || ["brand", "inStock", "minPrice", "maxPrice", "page"].includes(key)) {
        next.delete(key)
      }
    }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const facetsQuery = useFacets({
    category: locked ? lockedCategoryId : filters.category,
    department: filters.department,
    search: filters.search,
  })

  const facetPanel = (
    <ShopFacets
      facets={facetsQuery.data}
      isLoading={facetsQuery.isLoading}
      selected={filters}
      onChange={(patch) => setParams(patch)}
      onClear={clearFacets}
      hasActive={hasFacetFilters}
    />
  )

  const sortValue = `${filters.sortBy}-${filters.sortOrder}`
  const handleSortChange = (value) => {
    const [sortBy, sortOrder] = value.split("-")
    setParams({ sortBy, sortOrder })
  }

  // Paging is the one case that SHOULD scroll: page 3's products render where
  // page 2's were, so without it the shopper is left staring at row 4 of a grid
  // that silently changed under them.
  const goToPage = (page) =>
    setParams({ page }, { resetPage: false, scroll: true })

  const activeDepartment = departments?.find((d) => d.id === filters.department)
  const activeCategory = locked ? null : categories?.find((c) => c.id === filters.category)

  // Page numbers with ellipsis (1 … 4 5 6 … 12)
  const pageNumbers = (() => {
    const { page, pages } = pagination
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
    const nums = new Set([1, pages, page - 1, page, page + 1])
    const sorted = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
    const out = []
    let prev = 0
    for (const n of sorted) {
      if (n - prev > 1) out.push("…")
      out.push(n)
      prev = n
    }
    return out
  })()

  const taxonomyPickers = (
    <>
      <Select
        value={filters.department}
        onValueChange={(value) => setParams({ department: value, category: "all" })}
      >
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {departments?.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.category}
        onValueChange={(value) => setParams({ category: value })}
        disabled={categoriesLoading}
      >
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories?.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  const sortPicker = (
    <Select value={sortValue} onValueChange={handleSortChange}>
      <SelectTrigger className="w-full md:w-[180px]">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <>
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearch} className="flex max-w-md flex-1 gap-2">
          <Input
            type="search"
            placeholder={locked ? "Search in this category..." : "Search products..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="hidden items-center gap-2 md:flex">
          {!locked && taxonomyPickers}
          {sortPicker}
        </div>

        {/* Mobile filters. Sort lives outside the sheet — it's the control
            people reach for most, and burying it behind a modal to change
            "price: low to high" is a tax on every visit. */}
        <div className="flex gap-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="shrink-0">
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFacetCount > 0 && (
                  <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {activeFacetCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {!locked && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    {taxonomyPickers}
                  </div>
                )}
                {facetPanel}
                {hasActiveFilters && (
                  <Button variant="outline" className="w-full" onClick={clearAll}>
                    <X className="mr-2 h-4 w-4" />
                    Clear all filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1">{sortPicker}</div>
        </div>
      </div>

      {/* Active filter chips + results count */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{pagination.total}</span>{" "}
          {pagination.total === 1 ? "product" : "products"}
        </p>
        {filters.search && (
          <Badge variant="secondary" className="gap-1 pr-1">
            “{filters.search}”
            <button
              type="button"
              aria-label="Clear search"
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() => {
                setSearchInput("")
                setParams({ search: "" })
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {activeDepartment && (
          <Badge variant="secondary" className="gap-1 pr-1">
            {activeDepartment.name}
            <button
              type="button"
              aria-label="Clear department filter"
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() => setParams({ department: "all", category: "all" })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {activeCategory && (
          <Badge variant="secondary" className="gap-1 pr-1">
            {activeCategory.name}
            <button
              type="button"
              aria-label="Clear category filter"
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() => setParams({ category: "all" })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {/* Facet chips. A selected facet must be removable from the results
            area too — on mobile the panel is behind a sheet, and "why am I
            seeing 3 products?" shouldn't require opening a modal to find out. */}
        {filters.brands.map((b) => (
          <Badge key={b} variant="secondary" className="gap-1 pr-1">
            {b}
            <button
              type="button"
              aria-label={`Remove ${b} filter`}
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() =>
                setParams({ brand: filters.brands.filter((x) => x !== b) })
              }
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {Object.entries(filters.attrs).map(([key, value]) => (
          <Badge key={key} variant="secondary" className="gap-1 pr-1">
            {value}
            <button
              type="button"
              aria-label={`Remove ${key} filter`}
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() => setParams({ attr: { key, value: null } })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {filters.inStock && (
          <Badge variant="secondary" className="gap-1 pr-1">
            In stock
            <button
              type="button"
              aria-label="Remove in-stock filter"
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() => setParams({ inStock: null })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {(filters.minPrice !== null || filters.maxPrice !== null) && (
          <Badge variant="secondary" className="gap-1 pr-1">
            {formatNaira(filters.minPrice ?? facetsQuery.data?.price?.min ?? 0)} –{" "}
            {formatNaira(filters.maxPrice ?? facetsQuery.data?.price?.max ?? 0)}
            <button
              type="button"
              aria-label="Remove price filter"
              className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={() => setParams({ minPrice: null, maxPrice: null })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex gap-8">
        {/* Desktop facet sidebar */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">{facetPanel}</div>
        </aside>

        <div className="min-w-0 flex-1">
      {/* Products Grid */}
      {itemsLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <h2 className="mb-4 text-2xl font-semibold">No products found</h2>
          <p className="mb-8 text-muted-foreground">
            {locked
              ? "Nothing in this category matches your search yet."
              : "Try adjusting your filters or search terms."}
          </p>
          {hasActiveFilters && <Button onClick={clearAll}>Clear Filters</Button>}
        </div>
      ) : (
        <>
          {/* Keyed on the current page so paginating replays the stagger —
              otherwise page 2 swaps in with no acknowledgement that anything
              changed. Stagger is tight (40ms) because a full grid of 12+ would
              otherwise take most of a second to finish arriving. */}
          <RevealGroup
            key={pagination.page}
            className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
            stagger={0.04}
          >
            {items.map((item) => (
              <RevealItem key={item.id}>
                <ProductCard item={item} />
              </RevealItem>
            ))}
          </RevealGroup>

          {pagination.pages > 1 && (
            <nav
              className="mt-10 flex items-center justify-center gap-1.5"
              aria-label="Pagination"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === pagination.page ? "default" : "outline"}
                    size="sm"
                    className="h-9 w-9 p-0"
                    aria-current={n === pagination.page ? "page" : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {n}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
        </div>
      </div>
    </>
  )
}
