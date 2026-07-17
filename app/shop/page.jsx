"use client"

import { Suspense } from "react"
import Link from "next/link"

import PromoBanner from "@/components/promo-banner"
import ProductBrowser from "@/components/product-browser"

function ShopPageContent() {
  return (
    <div className="container px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl font-bold">Shop</h1>
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Shop</span>
        </div>
      </div>

      {/* Admin-managed banner (renders only when one is live) */}
      <PromoBanner placement="shop_banner" className="mb-6" />

      {/* Reads ?search= / ?category= / ?sortBy= / ?page= from the URL itself. */}
      <ProductBrowser />
    </div>
  )
}

// ProductBrowser reads useSearchParams, which requires a Suspense boundary.
export default function ShopPage() {
  return (
    <Suspense fallback={<div className="container px-4 py-12" />}>
      <ShopPageContent />
    </Suspense>
  )
}
