"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function VerifyPaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [message, setMessage] = useState('')
  const [orderId, setOrderId] = useState('')

  useEffect(() => {
    const reference = searchParams.get('reference')
    
    if (!reference) {
      setStatus('error')
      setMessage('Payment reference not found')
      return
    }

    // Verify payment with backend
    const verifyPayment = async () => {
      try {
        const response = await fetch(`/api/payment/paystack/verify?reference=${reference}`)
        const data = await response.json()

        if (!response.ok || data.status !== 'success') {
          throw new Error(data.error || 'Payment verification failed')
        }

        setStatus('success')
        setMessage('Payment successful!')
        setOrderId(data.data.orderId)

        // A guest's order isn't readable without its token (RLS denies it —
        // user_id is null, so `auth.uid() = user_id` is never true). The token
        // came back from Paystack in the callback URL; carry it to the receipt.
        const token = searchParams.get('t')
        const query = new URLSearchParams({ orderId: data.data.orderId })
        if (token) query.set('token', token)

        // Redirect to success page after 2 seconds
        setTimeout(() => {
          router.push(`/checkout/success?${query.toString()}`)
        }, 2000)
      } catch (error) {
        console.error('Verification error:', error)
        setStatus('error')
        setMessage(error.message || 'Payment verification failed')
      }
    }

    verifyPayment()
  }, [searchParams, router])

  return (
    <div className="container px-4 py-8 md:px-6 md:py-12 min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            {status === 'verifying' && (
              <>
                <div className="flex justify-center">
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                </div>
                <h2 className="text-2xl font-bold">Verifying Payment</h2>
                <p className="text-muted-foreground">
                  Please wait while we verify your payment...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-600">Payment Successful!</h2>
                <p className="text-muted-foreground">
                  {message}
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to order confirmation...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex justify-center">
                  <XCircle className="h-16 w-16 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold text-destructive">Payment Failed</h2>
                <p className="text-muted-foreground">
                  {message}
                </p>
                <div className="flex gap-2 justify-center pt-4">
                  <Button asChild>
                    <Link href="/checkout">Try Again</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/cart">Back to Cart</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
