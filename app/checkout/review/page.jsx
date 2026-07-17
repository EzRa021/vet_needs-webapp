"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CreditCard, Edit2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import CheckoutSteps from "@/components/checkout-steps"
import { useStoreSettings } from "@/stores/shopStore"
import { useCartStore } from "@/stores/cartStore"
import { useCheckoutStore } from "@/stores/checkoutStore"
import { useUser } from "@/stores/authStore"
import { formatNaira } from "@/lib/pricing"

export default function ReviewOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: user, isLoading: userLoading } = useUser()
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { items, getCartTotals } = useCartStore()
  const { shippingInfo, currentOrder, coupon } = useCheckoutStore()
  const { pricingConfig } = useStoreSettings()
  const totals = getCartTotals({ discount: coupon?.discount || 0, ...pricingConfig })

  // No auth gate: guests get this far too (011). Holding `currentOrder` is what
  // proves they're mid-checkout, and its guest_token is what proves the order is
  // theirs when they pay.

  // Redirect if no order or empty cart
  useEffect(() => {
    if (!currentOrder || items.length === 0) {
      router.push('/cart')
    }
  }, [currentOrder, items, router])

  const handlePlaceOrder = async () => {
    if (!currentOrder) return

    setIsProcessing(true)

    try {
      // Initialize Paystack payment
      const response = await fetch('/api/payment/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only the order id (+ the guest's token, which stands in for a
        // session) — the server takes the amount from the DB order.
        body: JSON.stringify({
          orderId: currentOrder.id,
          guestToken: currentOrder.guest_token || null,
        }),
      })

      const data = await response.json()

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.error || 'Failed to initialize payment')
      }

      // Redirect to Paystack payment page
      window.location.href = data.data.authorization_url
    } catch (error) {
      console.error('Payment initialization error:', error)
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  if (!currentOrder) {
    return null
  }

  return (
    <div className="container px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Review Your Order</h1>
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/cart" className="hover:text-primary">
            Cart
          </Link>
          <span className="mx-2">/</span>
          <Link href="/checkout" className="hover:text-primary">
            Checkout
          </Link>
          <span className="mx-2">/</span>
          <span>Review</span>
        </div>
      </div>

      <CheckoutSteps current={2} />

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* Shipping Information */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Shipping Information</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/checkout" className="flex items-center gap-1 text-primary">
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Contact Information</h3>
                <p className="text-sm">{shippingInfo.email}</p>
                <p className="text-sm">{shippingInfo.phone}</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Shipping Address</h3>
                <p className="text-sm">{shippingInfo.firstName} {shippingInfo.lastName}</p>
                <p className="text-sm">{shippingInfo.address}</p>
                {shippingInfo.address2 && <p className="text-sm">{shippingInfo.address2}</p>}
                <p className="text-sm">
                  {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zip}
                </p>
                <p className="text-sm">{shippingInfo.country}</p>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5" />
              <div>
                <p className="font-medium">Paystack Payment Gateway</p>
                <p className="text-sm text-muted-foreground">
                  Secure payment with credit/debit card
                </p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Order Items</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cart" className="flex items-center gap-1 text-primary">
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </div>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="relative h-20 w-20 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity}{item.unit_type === 'kg' ? ' kg' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatNaira(item.price * item.quantity)}</p>
                    <p className="text-sm text-muted-foreground">{formatNaira(item.price)} each</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div>
          <div className="sticky top-20">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatNaira(totals.subtotal)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex items-center justify-between text-success">
                      <span>Discount {coupon?.code ? `(${coupon.code})` : ""}</span>
                      <span className="tabular-nums">−{formatNaira(totals.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    {totals.freeShipping.qualifies ? (
                      <span className="font-medium text-success">Free</span>
                    ) : (
                      <span>{formatNaira(totals.shipping)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">VAT</span>
                    <span>
                      {totals.tax > 0
                        ? formatNaira(totals.tax)
                        : totals.includedTax > 0
                          ? `Included (${formatNaira(totals.includedTax)})`
                          : formatNaira(0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-medium text-lg">
                    <span>Total</span>
                    <span>{formatNaira(totals.total)}</span>
                  </div>

                  <div className="pt-4">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handlePlaceOrder}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Pay with Paystack'
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground pt-4">
                    By placing your order, you agree to our{" "}
                    <Link href="#" className="underline hover:text-primary">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="underline hover:text-primary">
                      Privacy Policy
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
