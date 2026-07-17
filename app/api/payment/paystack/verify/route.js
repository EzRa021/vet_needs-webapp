import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { confirmPaystackPayment } from '@/lib/payments/paystack'

// GET /api/payment/paystack/verify?reference=xxx
// Called by the browser after Paystack redirects back. The webhook is the
// real source of truth; this exists so the customer sees the result quickly.
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')

    const result = await confirmPaystackPayment(reference)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Only the order owner may see the confirmation details
    if (result.order.userId !== user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: 'success',
      message: 'Payment verified successfully',
      data: {
        orderId: result.order.orderId,
        amount: result.order.amount,
        reference: result.order.reference,
        paidAt: result.order.paidAt,
      },
    })
  } catch (error) {
    console.error('Paystack verification error:', error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}
