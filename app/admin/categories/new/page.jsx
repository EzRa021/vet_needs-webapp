"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { Spinner } from "@/components/ui/spinner"
import CategoryForm from "@/components/admin/category-form"
import { useAdminTaxonomy } from "@/stores/adminStore"

function NewCategoryContent() {
  const searchParams = useSearchParams()
  // "Add sub-category" from a tree row lands here with the parent preselected.
  const parentId = searchParams.get("parent")
  const { data: tree, isLoading } = useAdminTaxonomy()

  // The parent picker needs the tree, so wait for it rather than render a form
  // whose Select would briefly have nothing to choose from.
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return <CategoryForm tree={tree || []} node={null} defaultParentId={parentId} />
}

export default function NewCategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <NewCategoryContent />
    </Suspense>
  )
}
