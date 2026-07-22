"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { TriangleAlert, ArrowLeft, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import ImageUpload from "@/components/admin/image-upload"
import { useSaveCategory } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"

const ROOT_VALUE = "__root__"

// The parent picker must not offer the node itself or anything beneath it —
// that would be a cycle, and the DB's guard would reject it anyway. Better to
// not offer the move than to explain the error afterwards.
function flattenForParent(nodes, excludeId, out = [], depth = 0) {
  for (const n of nodes) {
    if (n.id === excludeId) continue // skips its whole subtree with it
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) flattenForParent(n.children, excludeId, out, depth + 1)
  }
  return out
}

// Shared by /admin/categories/new and /admin/categories/[id]/edit.
//
// Was a dialog. A category carries a description, an image and a parent — that's
// a page's worth of decisions, and a page can be linked to, opened in a tab and
// deep-linked from a breadcrumb. Same reasoning as the product CRUD pages.
export default function CategoryForm({ tree, node, defaultParentId }) {
  const router = useRouter()
  const { toast } = useToast()
  const save = useSaveCategory()
  const isEdit = Boolean(node)

  const [form, setForm] = useState({
    name: "",
    description: "",
    image_url: "",
    meta_title: "",
    meta_description: "",
    parent_id: ROOT_VALUE,
    sort_order: 0,
    is_active: true,
  })
  const [error, setError] = useState(null)
  // See product-form: submit stays disabled until the upload settles.
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setForm({
      name: node?.name || "",
      description: node?.description || "",
      image_url: node?.image_url || "",
      meta_title: node?.meta_title || "",
      meta_description: node?.meta_description || "",
      parent_id: node ? node.parent_id || ROOT_VALUE : defaultParentId || ROOT_VALUE,
      sort_order: node?.sort_order ?? 0,
      is_active: node?.is_active ?? true,
    })
  }, [node, defaultParentId])

  const parentOptions = flattenForParent(tree || [], node?.id)
  const isDepartment = form.parent_id === ROOT_VALUE

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError("Give the category a name.")
      return
    }
    try {
      await save.mutateAsync({
        id: node?.id,
        name: form.name.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim(),
        meta_title: form.meta_title.trim(),
        meta_description: form.meta_description.trim(),
        parent_id: form.parent_id === ROOT_VALUE ? null : form.parent_id,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      })
      toast({
        title: isEdit ? "Category updated" : "Category created",
        description: `“${form.name.trim()}” has been saved.`,
      })
      router.push("/admin/categories")
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href="/admin/categories">
              <ArrowLeft data-icon="inline-start" />
              Back to categories
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold">
              {isEdit ? form.name || "Edit category" : "New category"}
            </h1>
            <Badge variant={isDepartment ? "default" : "secondary"}>
              {isDepartment ? "Department" : "Category"}
            </Badge>
            {!form.is_active && <Badge variant="outline">Hidden</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            A category with no parent is a department — a top-level section of the shop.
          </p>
        </div>

        {isEdit && (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`/shop/category/${node.id}`} target="_blank">
              <Eye data-icon="inline-start" />
              View in shop
            </Link>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
              <CardDescription>What shoppers see on category pages.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={error && !form.name.trim() ? true : undefined}>
                  <FieldLabel htmlFor="cat-name">Name</FieldLabel>
                  <Input
                    id="cat-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Poultry Feeds"
                    aria-invalid={error && !form.name.trim() ? true : undefined}
                    autoFocus
                  />
                  <FieldDescription>
                    The web address is generated from this name automatically.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="cat-desc">Description</FieldLabel>
                  <Textarea
                    id="cat-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Shown under the heading on the category page. Optional."
                    rows={3}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search &amp; sharing</CardTitle>
              <CardDescription>
                What Google and WhatsApp show. Both optional — leave blank and the
                name and description above are used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cat-meta-title">Page title</FieldLabel>
                  <Input
                    id="cat-meta-title"
                    value={form.meta_title}
                    maxLength={70}
                    onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))}
                    placeholder={form.name || "e.g. Poultry Feeds in Nigeria"}
                  />
                  {/* Counts, because the limits aren't arbitrary — past them the
                      text is simply cut off in results. */}
                  <FieldDescription>
                    {form.meta_title.length}/70 · falls back to “{form.name || "the name"}”
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="cat-meta-desc">Search description</FieldLabel>
                  <Textarea
                    id="cat-meta-desc"
                    rows={2}
                    maxLength={160}
                    value={form.meta_description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, meta_description: e.target.value }))
                    }
                    placeholder="One sentence that would make someone click."
                  />
                  <FieldDescription>
                    {form.meta_description.length}/160 · falls back to the description
                    above
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Placement</CardTitle>
              <CardDescription>Where this sits in the shop&apos;s structure.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cat-parent">Parent</FieldLabel>
                  <Select
                    value={form.parent_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v }))}
                  >
                    <SelectTrigger id="cat-parent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={ROOT_VALUE}>
                          — None (make it a department)
                        </SelectItem>
                        {parentOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {" ".repeat(o.depth * 3)}
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Moving a category brings its sub-categories and products with it.
                    Nesting is capped at 5 levels.
                  </FieldDescription>
                </Field>

                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="cat-order">Sort order</FieldLabel>
                    <FieldDescription>Lower numbers appear first.</FieldDescription>
                  </div>
                  <Input
                    id="cat-order"
                    type="number"
                    className="w-24"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  />
                </Field>

                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="cat-active">Visible in store</FieldLabel>
                    <FieldDescription>
                      Turn off to hide this category and its products from shoppers.
                    </FieldDescription>
                  </div>
                  <Switch
                    id="cat-active"
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Image</CardTitle>
              <CardDescription>
                {isDepartment
                  ? "Shown on the department cards on the home page."
                  : "Shown on category cards and in the menu."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                value={form.image_url}
                onChange={(v) => setForm((f) => ({ ...f, image_url: v }))}
                onUploadingChange={setUploading}
                folder="categories"
                label={form.name || "Category"}
                className="[&>div:first-child]:w-full"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <Button type="submit" disabled={save.isPending || uploading}>
                {(save.isPending || uploading) && (
                  <Spinner data-icon="inline-start" />
                )}
                {uploading
                  ? "Uploading image…"
                  : isEdit
                    ? "Save changes"
                    : "Create category"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/categories">Cancel</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
