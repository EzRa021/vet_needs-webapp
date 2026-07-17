import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPaystackRefund } from '@/lib/payments/paystack'

// PATCH /api/admin/refunds/[id]  { action: 'approve' | 'reject', ... }
//
// Approving CALLS PAYSTACK. That's the whole point of this module: before it,
// "refunded" was a dropdown value and the money never left the merchant account.
//
// What this route may and may not do:
//   · it may ask Paystack to return money
//   · it may NOT mark the order refunded — refunds settle asynchronously, so
//     that's the refund.processed webhook's job (apply_refund_result, 016).
//     Marking it here would put the old lie back with extra steps.
export async function PATCH(request, { params }) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { user } = auth
    const { id } = await params
    const body = await request.json()

    const admin = createAdminClient()
    const { data: req, error: readErr } = await admin
      .from('refund_requests')
      .select('*, order:orders (id, total_amount, payment_reference, status)')
      .eq('id', id)
      .single()

    if (readErr || !req) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 })
    }

    if (req.status !== 'requested') {
      return NextResponse.json(
        { error: `This request is already ${req.status}.` },
        { status: 409 }
      )
    }

    // ---- Reject: no money moves, so nothing to verify. ----
    if (body.action === 'reject') {
      const { data, error } = await admin
        .from('refund_requests')
        .update({
          status: 'rejected',
          admin_notes: body.admin_notes?.trim() || null,
          reviewed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ data })
    }

    if (body.action !== 'approve') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    // ---- Approve ----
    if (!req.order?.payment_reference) {
      return NextResponse.json(
        { error: "This order has no payment reference — there's nothing for Paystack to refund." },
        { status: 400 }
      )
    }

    // Amount is validated against the order, not trusted: a typo'd extra zero
    // would refund more than the customer ever paid.
    const amount =
      body.amount === undefined || body.amount === null || body.amount === ''
        ? null
        : Number(body.amount)

    if (amount !== null) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Refund amount must be positive' }, { status: 400 })
      }
      if (amount > Number(req.order.total_amount)) {
        return NextResponse.json(
          { error: `Refund can't exceed the order total (${req.order.total_amount}).` },
          { status: 400 }
        )
      }
    }

    const result = await createPaystackRefund({
      reference: req.order.payment_reference,
      amountNaira: amount,
      note: body.admin_notes?.trim() || `Refund for order ${req.order_id.slice(0, 8)}`,
    })

    if (!result.ok) {
      // Record the attempt so staff aren't left guessing why nothing happened.
      await admin
        .from('refund_requests')
        .update({ admin_notes: `Paystack error: ${result.error}`, reviewed_by: user.id })
        .eq('id', id)

      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Paystack accepted it. Store the refund id FIRST — it's how the webhook
    // finds this row, and a webhook can land before this response does.
    await admin
      .from('refund_requests')
      .update({
        status: 'approved',
        requested_amount: amount,
        paystack_refund_id: result.refundId,
        restock: body.restock === true,
        admin_notes: body.admin_notes?.trim() || null,
        reviewed_by: user.id,
      })
      .eq('id', id)

    // Occasionally Paystack settles immediately (common in test mode). Apply the
    // same function the webhook would, so both paths agree and neither can
    // double-apply — apply_refund_result() is idempotent.
    if (result.status === 'processed') {
      await admin.rpc('apply_refund_result', {
        p_refund_id: result.refundId,
        p_success: true,
        p_amount: result.amount,
      })
    }

    return NextResponse.json({
      data: { id, paystack_refund_id: result.refundId, paystack_status: result.status },
      message:
        result.status === 'processed'
          ? 'Refund processed.'
          : 'Refund submitted to Paystack. The order will show as refunded once it settles.',
    })
  } catch (error) {
    console.error('Refund action API error:', error)
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })
  }
}
