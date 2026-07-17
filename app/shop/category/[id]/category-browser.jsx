"use client"

import { Suspense } from "react"
import { useParams, notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import ProductBrowser from "@/components/product-browser"
import { useTaxonomy } from "@/stores/shopStore"

// Walks the nested tree for the node AND its ancestors, so the breadcrumb can
// show the real trail (Home / Shop / Pet / Pet Kibbles) instead of a flat guess.
function findTrail(nodes, id, trail = []) {
  for (const node of nodes || []) {
    const next = [...trail, node]
    if (node.id === id) return next
    const found = findTrail(node.children, id, next)
    if (found) return found
  }
  return null
}

// This route browses ANY taxonomy node, not just leaf categories: the home page
// links departments here too, and /api/shop/items resolves a node to its whole
// subtree ("department is just a root category"). So a department shows
// everything nested beneath it.
// Client half. Split out so page.jsx can be a server component and export
// generateMetadata — category pages are the ones people actually link to.
export default function CategoryBrowser() {
  const { id } = useParams()
  const { data: tree, isLoading, isError } = useTaxonomy()

  if (isLoading) {
    return (
      <div className="container px-4 py-8 md:px-6 md:py-12">
        <Skeleton className="mb-2 h-4 w-48" />
        <Skeleton className="mb-8 h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // A failed taxonomy fetch is not the same as a missing category — throw so the
  // error boundary handles it, rather than telling the shopper it doesn't exist.
  if (isError) throw new Error("Could not load the category tree")

  const trail = findTrail(tree, id)

  // The id isn't in the tree: deleted, deactivated, or made up. That's a real
  // 404, and app/not-found.tsx now exists to render it properly.
  if (!trail) notFound()

  const node = trail[trail.length - 1]
  const children = node.children || []

  return (
    <div className="container px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/shop" className="hover:text-primary">
            Shop
          </Link>
          {trail.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              {i === trail.length - 1 ? (
                <span className="text-foreground">{crumb.name}</span>
              ) : (
                <Link href={`/shop/category/${crumb.id}`} className="hover:text-primary">
                  {crumb.name}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <h1 className="mb-2 font-display text-3xl font-bold md:text-4xl">{node.name}</h1>
        {node.description && (
          <p className="max-w-3xl text-muted-foreground">{node.description}</p>
        )}

        {/* Drill-down into sub-categories. The grid below already includes their
            products (the API resolves the whole subtree), so these narrow rather
            than reveal. */}
        {children.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {children.map((child) => (
              <Link key={child.id} href={`/shop/category/${child.id}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer px-3 py-1.5 text-sm font-normal hover:bg-secondary/70"
                >
                  {child.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ProductBrowser reads useSearchParams (sort/page/search), which needs a
          Suspense boundary. */}
      <Suspense fallback={<div className="py-12" />}>
        <ProductBrowser lockedCategoryId={id} />
      </Suspense>
    </div>
  )
}
