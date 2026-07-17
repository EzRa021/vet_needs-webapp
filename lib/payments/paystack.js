import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { orderConfirmedEmail } from '@/lib/email/templates'

// Ask Paystack to return money. This is the call that was missing entirely —
// `refunded` used to be a dropdown choice that moved nothing.
//
// Refunds are ASYNCHRONOUS: Paystack accepts the request and settles it later,
// so a successful response here means "accepted", not "returned". The order is
// only marked refunded when the refund.processed webhook confirms it
// (apply_refund_result, 016).
export async function createPaystackRefund({ reference, amountNaira, note }) {
  if (!reference) {
    return { ok: false, error: 'This order has no payment reference to refund.' }
  }

  try {
    const res = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: reference,
        // Omitted = full refund. Paystack works in kobo, like everything else.
        ...(amountNaira ? { amount: Math.round(Number(amountNaira) * 100) } : {}),
        merchant_note: note || undefined,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.status) {
      return { ok: false, error: data.message || `Paystack refused the refund (${res.status})` }
    }

    return {
      ok: true,
      refundId: String(data.data?.id ?? ''),
      // 'processed' occasionally comes back immediately (notably in test mode);
      // usually it's 'pending' and the webhook finishes the job.
      status: data.data?.status || 'pending',
      amount: data.data?.amount != null ? Number(data.data.amount) / 100 : null,
    }
  } catch (error) {
    console.error('Paystack refund threw:', error.message)
    return { ok: false, error: 'Could not reach Paystack.' }
  }
}

// Shared, authoritative payment confirmation used by BOTH the browser
// verify route and the Paystack webhook.
//
// Checks: transaction succeeded at Paystack, currency is NGN, amount paid
// matches the order total, then marks the order paid + decrements stock
// atomically via the mark_order_paid() SQL function.
export async function confirmPaystackPayment(reference) {
  if (!reference) return { ok: false, status: 400, error: 'Payment reference is required' }

  // 1. Ask Paystack directly (never trust the browser)
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  )
  const data = await response.json()

  if (!response.ok || !data.status) {
    return { ok: false, status: 400, error: data.message || 'Payment verification failed' }
  }

  const payment = data.data
  if (payment.status !== 'success') {
    return { ok: false, status: 400, error: `Payment was not successful (${payment.status})` }
  }
  if (payment.currency !== 'NGN') {
    return { ok: false, status: 400, error: 'Unexpected payment currency' }
  }

  // 2. Find the order this payment belongs to
  const supabase = createAdminClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id, total_amount, status, payment_reference')
    .eq('payment_reference', reference)
    .single()

  if (orderError || !order) {
    console.error('Order not found for reference:', reference, orderError)
    return { ok: false, status: 404, error: 'Order not found for this payment' }
  }

  // 3. Amount must match the order total exactly (both in kobo)
  const expectedKobo = Math.round(Number(order.total_amount) * 100)
  if (payment.amount !== expectedKobo) {
    console.error(
      `Payment amount mismatch for order ${order.id}: paid ${payment.amount}, expected ${expectedKobo}`
    )
    return { ok: false, status: 400, error: 'Payment amount does not match order total' }
  }

  // 4. Atomically mark paid + decrement stock (idempotent: only fires while pending)
  const { data: marked, error: rpcError } = await supabase.rpc('mark_order_paid', {
    p_reference: reference,
  })

  if (rpcError) {
    console.error('mark_order_paid error:', rpcError)
    return { ok: false, status: 500, error: 'Failed to finalize order' }
  }

  // 5. Confirmation email — but ONLY when this call is the one that flipped the
  //    order to paid. Both the browser's /checkout/verify and the webhook run
  //    this function for the same payment; mark_order_paid() returns true to
  //    exactly one of them, which makes it the natural send-once hook. Without
  //    that check, every customer would get two receipts.
  if (marked === true) {
    // Deliberately not awaited for its result to matter, and never allowed to
    // throw: the order IS paid. sendEmail() swallows its own errors, and this
    // catch covers the fetch of the order itself.
    try {
      const { data: full } = await supabase
        .from('orders')
        .select(
          'id, email, guest_token, order_items, subtotal, shipping_fee, tax_amount, discount_amount, coupon_code, total_amount'
        )
        .eq('id', order.id)
        .single()

      if (full?.email) {
        const { subject, html, text } = orderConfirmedEmail(full)
        await sendEmail({ to: full.email, subject, html, text })
      }
    } catch (e) {
      console.error('Order confirmation email failed (order is still paid):', e.message)
    }
  }

  // marked === false means it was already processed — treat as success (idempotent)
  return {
    ok: true,
    alreadyProcessed: marked === false,
    order: {
      orderId: order.id,
      userId: order.user_id,
      amount: payment.amount / 100,
      reference,
      paidAt: payment.paid_at,
    },
  }
}
