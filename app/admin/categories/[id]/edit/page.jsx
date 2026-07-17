"use client"

import { useParams } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TriangleAlert } from "lucide-react"
import CategoryForm from "@/components/admin/category-form"
import { useAdminTaxonomy } from "@/stores/adminStore"

// Walk the nested tree for one node. No separate fetch: the taxonomy is one
// cached query that the list page has usually already warmed, and the form
// needs the whole tree anyway for its parent picker.
function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

export default function EditCategoryPage() {
  const { id } = useParams()
  const { data: tree, isLoading, isError } = useAdminTaxonomy()

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const node = isError ? null : findNode(tree, id)

  if (!node) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert variant="destructive" className="max-w-lg">
          <TriangleAlert />
          <AlertTitle>Category not found</AlertTitle>
          <AlertDescription>
            {isError
              ? "The category tree couldn't be loaded. Refresh and try again."
              : "It may have been deleted, or the link is wrong."}
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/admin/categories">Back to categories</Link>
        </Button>
      </div>
    )
  }

  return <CategoryForm tree={tree || []} node={node} />
}
