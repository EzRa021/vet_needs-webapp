import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { confirmPaystackPayment } from '@/lib/payments/paystack'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/payment/paystack/webhook
// Source of truth for payments. Paystack calls this server-to-server, so the
// order gets marked paid even if the customer closes their browser.
// Configure in Paystack dashboard: Settings → API Keys & Webhooks →
//   https://YOUR-DOMAIN/api/payment/paystack/webhook
export async function POST(request) {
  try {
    const rawBody = await request.text()

    // Verify the request really came from Paystack (HMAC-SHA512 signature)
    const signature = request.headers.get('x-paystack-signature')
    const expected = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(rawBody)
      .digest('hex')

    if (!signature || signature !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)

    if (event.event === 'charge.success') {
      const reference = event.data?.reference
      // Re-verify with Paystack's API + amount check + atomic fulfillment.
      const result = await confirmPaystackPayment(reference)
      if (!result.ok) {
        console.error(`Webhook: confirmation failed for ${reference}: ${result.error}`)
        // 200 for business-rule failures so Paystack doesn't retry forever;
        // the error is logged for manual review.
      }
    }

    // Refunds settle asynchronously, so THIS is the moment the money is
    // actually back with the customer — and the only thing that may mark an
    // order 'refunded' (016). Before this existed, staff flipped the status by
    // hand and nothing moved.
    if (event.event === 'refund.processed' || event.event === 'refund.failed') {
      const refundId = String(event.data?.id ?? '')
      const success = event.event === 'refund.processed'
      const amount = event.data?.amount != null ? Number(event.data.amount) / 100 : null

      const admin = createAdminClient()
      const { error } = await admin.rpc('apply_refund_result', {
        p_refund_id: refundId,
        p_success: success,
        p_amount: amount,
      })

      if (error) {
        console.error(`Webhook: apply_refund_result failed for refund ${refundId}:`, error)
      }
    }

    // Acknowledge receipt (Paystack retries non-200 responses)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Paystack webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
