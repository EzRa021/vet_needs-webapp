"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, FolderTree, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import CategoryTree from "@/components/admin/category-tree"
import { useAdminTaxonomy, useDeleteCategory, useSaveCategory } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"

export default function AdminCategoriesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: tree, isLoading, isError } = useAdminTaxonomy()
  const del = useDeleteCategory()
  const save = useSaveCategory()

  // Delete stays a dialog: it's one irreversible yes/no, not a form. Editing is
  // a page (a name, description, image, parent and visibility is a page's worth
  // of decisions, and it deserves a URL you can link to or open in a tab).
  const [pendingDelete, setPendingDelete] = useState(null)

  // Reorder within a parent.
  //
  // NOT a swap of the two rows' sort_order values: they're all 0 by default
  // (nothing has ever set them), so swapping 0 with 0 is a no-op and the arrows
  // would look broken. Renumber the whole sibling list from its new order
  // instead — self-healing, and it only writes the rows that actually changed.
  const handleMove = async (node, siblings, index, direction) => {
    const target = index + direction
    if (target < 0 || target >= siblings.length) return

    const reordered = [...siblings]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)

    try {
      await Promise.all(
        reordered
          .map((n, i) => ({ n, i }))
          .filter(({ n, i }) => n.sort_order !== i)
          .map(({ n, i }) =>
            save.mutateAsync({
              id: n.id,
              sort_order: i,
              // Reordering must not rename or re-slug anything.
              regenerate_slug: false,
            })
          )
      )
    } catch (err) {
      toast({
        title: "Couldn't reorder",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await del.mutateAsync(pendingDelete.id)
      toast({
        title: "Category deleted",
        description: `“${pendingDelete.name}” has been removed.`,
      })
      setPendingDelete(null)
    } catch (err) {
      // Guard messages (has children / has products) come back from the API
      toast({
        title: "Can’t delete this category",
        description: err.message,
        variant: "destructive",
      })
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Organise your shop. A category with no parent is a department.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/categories/new">
            <Plus data-icon="inline-start" />
            New department
          </Link>
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load categories</AlertTitle>
          <AlertDescription>
            Make sure migrations 002 and 003 have been run, then refresh.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Category tree</CardTitle>
                <CardDescription>
                  Hover a row to add a sub-category, edit, or delete it. Nesting
                  is capped at 5 levels.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/categories/new">
                  <Plus data-icon="inline-start" />
                  Department
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : !tree || tree.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderTree />
                  </EmptyMedia>
                  <EmptyTitle>No categories yet</EmptyTitle>
                  <EmptyDescription>
                    Start with a department like “Pet” or “Feed”, then add
                    categories inside it.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/admin/categories/new">
                      <Plus data-icon="inline-start" />
                      Create your first department
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <CategoryTree
                tree={tree}
                onAddChild={(node) =>
                  router.push(`/admin/categories/new?parent=${node.id}`)
                }
                onEdit={(node) => router.push(`/admin/categories/${node.id}/edit`)}
                onDelete={setPendingDelete}
                onMove={handleMove}
              />
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Categories that still hold products or
              sub-categories are protected — move those first, or hide the
              category instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
