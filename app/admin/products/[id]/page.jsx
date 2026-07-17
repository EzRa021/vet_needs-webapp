"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Pencil,
  Eye,
  Trash2,
  MoreHorizontal,
  TriangleAlert,
  Package,
  Banknote,
  Receipt,
  Scale,
  Star,
  FolderTree,
  Tag,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import BrandImage from "@/components/brand-image"
import ProductHistory from "@/components/admin/product-history"
import { useAdminProduct, useDeleteProduct, useSaveProduct } from "@/stores/adminStore"
import { useToast } from "@/hooks/use-toast"
import { formatNaira } from "@/lib/pricing"
import { cn } from "@/lib/utils"

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <Card className="gap-0 py-4">
      <CardHeader className="px-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">
            {label}
          </CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 px-4">
        <span
          className={cn(
            "font-display text-xl font-bold tabular-nums leading-none",
            tone === "danger" && "text-destructive"
          )}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  )
}

export default function ProductDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: product, isLoading, isError } = useAdminProduct(id)
  const del = useDeleteProduct()
  const save = useSaveProduct()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>Product not found</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          It may have been deleted.
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/products">Back to products</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const stock = Number(product.stock)
  const isKg = product.unit_type === "kg"
  const unit = isKg ? " kg" : ""
  const lowStock = stock > 0 && stock <= Number(product.low_stock_threshold ?? 10)
  const outOfStock = stock === 0 && !product.allow_backorder
  const hasDiscount = product.compare_at_price && Number(product.compare_at_price) > Number(product.price)
  const margin =
    Number(product.price) > 0 && Number(product.cost_price) > 0
      ? Math.round(((product.price - product.cost_price) / product.price) * 1000) / 10
      : null

  const toggleActive = async () => {
    try {
      await save.mutateAsync({ id: product.id, is_active: !product.is_active })
      toast({
        title: product.is_active ? "Product hidden" : "Product is live",
        description: `“${product.name}” is now ${product.is_active ? "inactive" : "active"}.`,
      })
    } catch (err) {
      toast({ title: "Couldn't update", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      await del.mutateAsync(product.id)
      toast({ title: "Product deleted", description: `“${product.name}” has been removed.` })
      router.push("/admin/products")
    } catch (err) {
      toast({ title: "Can't delete this product", description: err.message, variant: "destructive" })
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href="/admin/products">
              <ArrowLeft data-icon="inline-start" />
              Back to products
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold">{product.name}</h1>
            <Badge variant={product.is_active ? "secondary" : "outline"}>
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
            {product.is_featured && (
              <Badge className="gap-1 border-transparent bg-earth text-earth-foreground">
                <Star className="size-3 fill-current" />
                Featured
              </Badge>
            )}
            {outOfStock && <Badge variant="destructive">Out of stock</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {product.sku || "No SKU"}
            {product.brand ? ` · ${product.brand}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/admin/products/${product.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/product/${product.id}`} target="_blank">
                    <Eye />
                    View in store
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleActive}>
                  <Package />
                  {product.is_active ? "Set inactive" : "Set active"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Alerts */}
      {outOfStock && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Out of stock</AlertTitle>
          <AlertDescription>
            Shoppers can see this product but can&apos;t buy it. Add stock, or enable
            backorder to keep selling.
          </AlertDescription>
        </Alert>
      )}
      {!outOfStock && lowStock && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Low stock</AlertTitle>
          <AlertDescription>
            Only {stock}
            {unit} left — at or below the alert threshold of{" "}
            {Number(product.low_stock_threshold)}
            {unit}.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Banknote}
          label="Price"
          value={formatNaira(product.price)}
          sub={isKg ? "per kg" : "per unit"}
        />
        <Stat
          icon={Package}
          label="Stock"
          value={`${stock}${unit}`}
          sub={`Alert at ${Number(product.low_stock_threshold)}${unit}`}
          tone={outOfStock || lowStock ? "danger" : undefined}
        />
        <Stat
          icon={Scale}
          label="Margin"
          value={margin === null ? "—" : `${margin}%`}
          sub={
            margin === null
              ? "Add a cost price"
              : `${formatNaira(product.price - product.cost_price)} profit`
          }
          tone={margin !== null && margin < 0 ? "danger" : undefined}
        />
        <Stat
          icon={Receipt}
          label="VAT"
          value={product.vat_enabled ? `${Number(product.vat_rate)}%` : "Exempt"}
          sub={product.vat_enabled ? (product.vat_inclusive ? "Included in price" : "Added at checkout") : "No VAT charged"}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {product.description ? (
                    <p className="text-sm">{product.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No short description.</p>
                  )}
                  {product.long_description && (
                    <>
                      <Separator />
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {product.long_description}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pricing &amp; tax</CardTitle>
                  <CardDescription>What the customer pays and what you keep.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  <Row label="Selling price">
                    <span className="tabular-nums">{formatNaira(product.price)}</span>
                    {isKg && <span className="text-muted-foreground"> / kg</span>}
                  </Row>
                  <Row label="Compare at">
                    {hasDiscount ? (
                      <span className="tabular-nums line-through text-muted-foreground">
                        {formatNaira(product.compare_at_price)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Row>
                  <Row label="Cost price">
                    {product.cost_price ? (
                      <span className="tabular-nums">{formatNaira(product.cost_price)}</span>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </Row>
                  <Row label="VAT">
                    {product.vat_enabled ? (
                      <span>
                        {Number(product.vat_rate)}%{" "}
                        <span className="text-muted-foreground">
                          ({product.vat_inclusive ? "inclusive" : "exclusive"})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Exempt</span>
                    )}
                  </Row>
                </CardContent>
              </Card>

              {product.attributes && Object.keys(product.attributes).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Specifications</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col divide-y">
                    {Object.entries(product.attributes).map(([k, v]) => (
                      <Row key={k} label={k.replace(/_/g, " ")}>
                        {String(v)}
                      </Row>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                    <BrandImage
                      src={product.image_url}
                      alt={product.name}
                      fill
                      sizes="320px"
                      className="object-cover"
                      placeholderLabel="No image"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Organisation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  <Row label="Category">
                    {product.category ? (
                      <Link
                        href={`/admin/categories`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <FolderTree className="size-3.5" />
                        {product.category.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Uncategorised</span>
                    )}
                  </Row>
                  {product.category?.path && (
                    <Row label="Path">
                      <code className="text-xs text-muted-foreground">/{product.category.path}</code>
                    </Row>
                  )}
                  <Row label="Sold by">{isKg ? "Kilogram" : "Piece"}</Row>
                  <Row label="Backorder">
                    {product.allow_backorder ? "Allowed" : "Not allowed"}
                  </Row>
                </CardContent>
              </Card>

              {product.tags?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {product.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1">
                          <Tag className="size-3" />
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Record</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  <Row label="Created">
                    {new Date(product.created_at).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Row>
                  <Row label="Updated">
                    {new Date(product.updated_at).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Row>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>
                Stock, price and VAT changes are recorded automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductHistory history={product.history || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{product.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Products that appear in past orders are
              protected — set them inactive instead so order history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
