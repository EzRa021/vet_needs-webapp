"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import ProductForm from "@/components/admin/product-form"
import { useAdminProduct } from "@/stores/adminStore"

export default function EditProductPage() {
  const { id } = useParams()
  const { data: product, isLoading, isError } = useAdminProduct(id)

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

  return <ProductForm product={product} />
}
