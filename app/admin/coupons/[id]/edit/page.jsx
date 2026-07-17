"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import CouponForm from "@/components/admin/coupon-form"
import { useAdminCoupon } from "@/stores/adminStore"

export default function EditCouponPage() {
  const { id } = useParams()
  const { data: coupon, isLoading, isError } = useAdminCoupon(id)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !coupon) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>Coupon not found</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          It may have been deleted.
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/coupons">Back to coupons</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return <CouponForm coupon={coupon} />
}
