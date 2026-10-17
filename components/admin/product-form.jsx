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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import BrandImage from "@/components/brand-image"
import ImageUpload from "@/components/admin/image-upload"
import ProductGallery from "@/components/admin/product-gallery"
import { AttributesEditor, TagsInput } from "@/components/admin/attributes-editor"
import { useSaveProduct, useAdminTaxonomy, useAdminSettings } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"

const NO_CATEGORY = "__none__"

const EMPTY = {
  name: "",
  sku: "",
  brand: "",
  description: "",
  long_description: "",
  image_url: "",
  attributes: {},
  tags: [],
  category_id: NO_CATEGORY,
  price: "",
  compare_at_price: "",
  cost_price: "",
  vat_enabled: true,
  vat_rate: 7.5,
  vat_inclusive: true,
  unit_type: "piece",
  stock: 0,
  low_stock_threshold: 10,
  allow_backorder: false,
  is_active: true,
  is_featured: false,
}

function flatten(nodes, out = [], depth = 0) {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) flatten(n.children, out, depth + 1)
  }
  return out
}

export default function ProductForm({ product }) {
  const router = useRouter()
  const { toast } = useToast()
  const save = useSaveProduct()
  const { data: tree } = useAdminTaxonomy()
  const isEdit = Boolean(product?.id)

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  // Blocks submit while an image is still uploading — saving mid-upload would
  // persist the previous image_url and quietly discard the new file.
  const [uploading, setUploading] = useState(false)

  // The "Default VAT rate" setting is meant to be exactly this — the value a new
  // product starts with. Nothing read it before, so the admin could change it
  // and every new product still got the hardcoded 7.5. (017 also fixed its
  // units: it was stored as a decimal while items store a percent.)
  const { data: settings } = useAdminSettings()
  useEffect(() => {
    if (product) return // editing: the product's own rate wins
    const rate = Number(settings?.vat_rate)
    if (Number.isFinite(rate) && rate > 0) {
      setForm((f) => ({ ...f, vat_rate: rate }))
    }
  }, [product, settings?.vat_rate])

  useEffect(() => {
    if (!product) return
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, product[k] ?? EMPTY[k]])),
      category_id: product.category_id || NO_CATEGORY,
      sku: product.sku || "",
      brand: product.brand || "",
      description: product.description || "",
      long_description: product.long_description || "",
      image_url: product.image_url || "",
      compare_at_price: product.compare_at_price ?? "",
      cost_price: product.cost_price ?? "",
      attributes: product.attributes || {},
      tags: product.tags || [],
    })
  }, [product])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const categories = flatten(tree || [])
  const isKg = form.unit_type === "kg"

  // ── The category this product arrived with ────────────────────────────────
  //
  // Kept so a save can tell "the user chose this" from "this is what was
  // already there". A product whose stored category is not one of ours — an id
  // left by an import, or a category since deleted — must still be editable:
  // the field it is wrong in is not the field being edited.
  const savedCategory = product?.category_id ?? null
  // Only once the list has actually loaded. A slow taxonomy fetch must not
  // accuse a perfectly good category of being unrecognised.
  const categoryUnknown =
    Boolean(tree) &&
    form.category_id !== NO_CATEGORY &&
    !categories.some((c) => c.id === form.category_id)

  const margin =
    Number(form.price) > 0 && Number(form.cost_price) > 0
      ? Math.round(((Number(form.price) - Number(form.cost_price)) / Number(form.price)) * 1000) / 10
      : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError("Give the product a name.")
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    if (form.price === "" || Number(form.price) < 0) {
      setError("Enter a valid price.")
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    if (form.compare_at_price !== "" && Number(form.compare_at_price) <= Number(form.price)) {
      setError(
        "The “compare at” price must be higher than the price — it's the old price shown struck through."
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    try {
      const { stock, category_id, ...rest } = form
      const picked = category_id === NO_CATEGORY ? null : category_id

      const saved = await save.mutateAsync({
        id: product?.id,
        ...rest,
        // Stock is only sent on CREATE (the opening balance). On edit it's
        // omitted entirely — not just read-only in the UI. Otherwise a form
        // opened before someone used Adjust Stock would submit its stale total
        // and silently revert their adjustment, logging a reasonless change on
        // top. Stock moves through adjust_stock() (021) or not at all.
        ...(isEdit ? {} : { stock }),
        // ── THE CATEGORY GOES UP ONLY WHEN IT CHANGED ────────────────────────
        //
        // PATCH is a partial and an absent key means "leave this column
        // alone", so an untouched category is simply not mentioned.
        //
        // This is what lets a product with an unrecognised category be edited
        // at all. Its id went up unchanged on every save, validation refused
        // it — "That id is not valid." in a red banner — and the save was lost
        // whatever it was for: a price, a description, a photograph nobody
        // could see was the thing being blocked.
        ...(!isEdit || picked !== savedCategory ? { category_id: picked } : {}),
      })
      toast({
        title: isEdit ? "Product updated" : "Product created",
        description: `“${form.name.trim()}” has been saved.`,
      })
      router.push(`/admin/products/${product?.id || saved.id}`)
    } catch (err) {
      setError(err.message)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const cancelHref = isEdit ? `/admin/products/${product.id}` : "/admin/products"
  const actions = (
    <>
      <Button type="button" variant="outline" asChild>
        <Link href={cancelHref}>Cancel</Link>
      </Button>
      <Button type="submit" disabled={save.isPending || uploading}>
        {(save.isPending || uploading) && <Spinner data-icon="inline-start" />}
        {uploading
          ? "Uploading image…"
          : isEdit
            ? "Save changes"
            : "Create product"}
      </Button>
    </>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href={isEdit ? `/admin/products/${product.id}` : "/admin/products"}>
              <ArrowLeft data-icon="inline-start" />
              {isEdit ? "Back to product" : "Back to products"}
            </Link>
          </Button>
          <h1 className="font-display text-xl font-bold">
            {isEdit ? `Edit ${product.name}` : "New product"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Stock, price and VAT changes are recorded in this product's history."
              : "Fill in the details. The product goes live once it's active."}
          </p>
        </div>
        {/* Desktop keeps the actions in the header, where there is room beside
            the title. On a phone they would sit above every field — you would
            reach for Save before you had filled anything in — so they move to
            the end of the form instead. Defined once, placed twice. */}
        <div className="hidden items-center gap-2 md:flex">{actions}</div>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Main column ---- */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
              <CardDescription>What shoppers see on the product page.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={error && !form.name.trim() ? true : undefined}>
                  <FieldLabel htmlFor="p-name">Name</FieldLabel>
                  <Input
                    id="p-name"
                    value={form.name}
                    onChange={setInput("name")}
                    placeholder="e.g. Layer Mash 25kg"
                    aria-invalid={error && !form.name.trim() ? true : undefined}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="p-sku">SKU</FieldLabel>
                    <Input id="p-sku" value={form.sku} onChange={setInput("sku")} placeholder="FEED-PLT-001" />
                    <FieldDescription>Must be unique.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-brand">Brand</FieldLabel>
                    <Input id="p-brand" value={form.brand} onChange={setInput("brand")} placeholder="TopFeeds" />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="p-desc">Short description</FieldLabel>
                  <Textarea
                    id="p-desc"
                    rows={2}
                    value={form.description}
                    onChange={setInput("description")}
                    placeholder="One line shown on product cards."
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="p-long">Full description</FieldLabel>
                  <Textarea
                    id="p-long"
                    rows={6}
                    value={form.long_description}
                    onChange={setInput("long_description")}
                    placeholder="Detail shown on the product page."
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Specifications</CardTitle>
              <CardDescription>
                Shown as a spec table on the product page — and each one becomes a
                shop filter once two products share it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Attributes</FieldLabel>
                  <AttributesEditor
                    value={form.attributes}
                    onChange={set("attributes")}
                  />
                  <FieldDescription>
                    Use the same key across products — “bag_size” on two products is
                    a filter; “bag_size” and “bagsize” are two dead ones.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>Tags</FieldLabel>
                  <TagsInput value={form.tags} onChange={set("tags")} />
                  <FieldDescription>
                    Extra words that should find this product in search — brand
                    nicknames, local names, common misspellings.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
              <CardDescription>All amounts in Naira (₦).</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="p-price">
                      Price {isKg && <span className="text-muted-foreground">(per kg)</span>}
                    </FieldLabel>
                    <Input
                      id="p-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={setInput("price")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-compare">Compare at</FieldLabel>
                    <Input
                      id="p-compare"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.compare_at_price}
                      onChange={setInput("compare_at_price")}
                    />
                    <FieldDescription>Old price, struck through.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-cost">Cost price</FieldLabel>
                    <Input
                      id="p-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.cost_price}
                      onChange={setInput("cost_price")}
                    />
                    <FieldDescription>Never shown to shoppers.</FieldDescription>
                  </Field>
                </div>

                {margin !== null && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Margin</span>
                    <Badge variant={margin < 0 ? "destructive" : "secondary"} className="tabular-nums">
                      {margin}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatNaira(Number(form.price) - Number(form.cost_price))} profit per{" "}
                      {isKg ? "kg" : "unit"}
                    </span>
                  </div>
                )}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventory</CardTitle>
              <CardDescription>How this item is counted and sold.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Sold by</FieldLabel>
                  <ToggleGroup
                    type="single"
                    value={form.unit_type}
                    onValueChange={(v) => v && set("unit_type")(v)}
                    variant="outline"
                    className="justify-start"
                  >
                    <ToggleGroupItem value="piece">Piece</ToggleGroupItem>
                    <ToggleGroupItem value="kg">Kilogram</ToggleGroupItem>
                  </ToggleGroup>
                  <FieldDescription>
                    {isKg
                      ? "Stock and quantities can be fractional (e.g. 25.5 kg)."
                      : "Stock and quantities are whole numbers."}
                  </FieldDescription>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="p-stock">
                      {isEdit ? "Stock" : "Opening stock"} {isKg ? "(kg)" : "(units)"}
                    </FieldLabel>
                    <Input
                      id="p-stock"
                      type="number"
                      step={isKg ? "0.001" : "1"}
                      min="0"
                      value={form.stock}
                      onChange={setInput("stock")}
                      // Read-only when editing: retyping a total is how "40 → 12"
                      // ends up in the history with no reason, and how two people
                      // counting the same shelf overwrite each other. Adjust Stock
                      // records a delta and a reason (021). Still editable on
                      // create — an opening balance has no history to explain.
                      readOnly={isEdit}
                      className={isEdit ? "bg-muted text-muted-foreground" : undefined}
                    />
                    {isEdit && (
                      <FieldDescription>
                        Use <strong>Adjust stock</strong> on the product page — it
                        records what changed and why.
                      </FieldDescription>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-low">Low stock alert at</FieldLabel>
                    <Input
                      id="p-low"
                      type="number"
                      step={isKg ? "0.001" : "1"}
                      min="0"
                      value={form.low_stock_threshold}
                      onChange={setInput("low_stock_threshold")}
                    />
                  </Field>
                </div>

                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="p-backorder">Allow backorder</FieldLabel>
                    <FieldDescription>Keep selling when stock hits zero.</FieldDescription>
                  </div>
                  <Switch
                    id="p-backorder"
                    checked={form.allow_backorder}
                    onCheckedChange={set("allow_backorder")}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">VAT</CardTitle>
              <CardDescription>Matches how your POS handles tax, per item.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="p-vat">Charge VAT on this item</FieldLabel>
                    <FieldDescription>Turn off for VAT-exempt goods.</FieldDescription>
                  </div>
                  <Switch id="p-vat" checked={form.vat_enabled} onCheckedChange={set("vat_enabled")} />
                </Field>

                {form.vat_enabled && (
                  <>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="p-vatrate">VAT rate (%)</FieldLabel>
                      <Input
                        id="p-vatrate"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="w-24"
                        value={form.vat_rate}
                        onChange={setInput("vat_rate")}
                      />
                    </Field>
                    <Field orientation="horizontal">
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="p-vatinc">Price includes VAT</FieldLabel>
                        <FieldDescription>
                          {form.vat_inclusive
                            ? "The price above already contains VAT — nothing is added at checkout."
                            : "VAT will be ADDED on top of the price at checkout."}
                        </FieldDescription>
                      </div>
                      <Switch
                        id="p-vatinc"
                        checked={form.vat_inclusive}
                        onCheckedChange={set("vat_inclusive")}
                      />
                    </Field>
                  </>
                )}
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        {/* ---- Side column ---- */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visibility</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="p-active">Active</FieldLabel>
                    <FieldDescription>Visible to shoppers.</FieldDescription>
                  </div>
                  <Switch id="p-active" checked={form.is_active} onCheckedChange={set("is_active")} />
                </Field>
                <Field orientation="horizontal">
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="p-featured">Featured</FieldLabel>
                    <FieldDescription>Show on the home page.</FieldDescription>
                  </div>
                  <Switch
                    id="p-featured"
                    checked={form.is_featured}
                    onCheckedChange={set("is_featured")}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organisation</CardTitle>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="p-cat">Category</FieldLabel>
                <Select value={form.category_id} onValueChange={set("category_id")}>
                  <SelectTrigger id="p-cat">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_CATEGORY}>— Uncategorised</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {" ".repeat(c.depth * 3)}
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {categoryUnknown ? (
                    <>
                      This product is filed under a category that is not in your
                      list — <span className="font-mono">{form.category_id}</span>.
                      It stays as it is unless you choose one here.
                    </>
                  ) : (
                    "Shoppers find this under its category and everything above it."
                  )}
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Main image</CardTitle>
              <CardDescription>
                Shown on the shop grid and as the first gallery photo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ImageUpload
                value={form.image_url}
                onChange={set("image_url")}
                onUploadingChange={setUploading}
                folder="products"
                label={form.name || "Product image"}
                className="[&>div:first-child]:w-full"
              />
            </CardContent>
          </Card>

          {/* Gallery rows reference item_id, so there has to be an item first.
              Saying so beats a disabled dropzone that looks broken. */}
          {product?.id ? (
            <ProductGallery itemId={product.id} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gallery</CardTitle>
                <CardDescription>
                  Save the product first, then add extra photos here.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {isEdit && (
            <Button type="button" variant="outline" asChild>
              <Link href={`/product/${product.id}`} target="_blank">
                <Eye data-icon="inline-start" />
                View in store
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile action bar — the same buttons, at the end of the form where you
          actually finish. grid-cols-2 gives both a full-width thumb target. */}
      <div className="grid grid-cols-2 gap-2 [&>*]:w-full md:hidden">
        {actions}
      </div>
    </form>
  )
}
