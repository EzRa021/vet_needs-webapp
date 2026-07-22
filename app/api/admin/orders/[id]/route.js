import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, OrderUpdateSchema } from '@/lib/validation/admin'
import { sendEmail } from '@/lib/email/send'
import { orderShippedEmail, orderDeliveredEmail } from '@/lib/email/templates'

// Statuses worth emailing about. 'processing' isn't — "we're packing it" is
// noise; 'canceled'/'refunded' are conversations staff are already having.
const EMAIL_ON_STATUS = {
  shipped: orderShippedEmail,
  delivered: orderDeliveredEmail,
}

// Statuses staff may set by hand.
//
// 'paid' is absent: only the Paystack webhook / verify flow may mark an order
// paid (mark_order_paid), because that also decrements stock atomically.
// Letting an operator set 'paid' would bypass payment verification.
//
// 'refunded' is absent for exactly the same reason, pointed the other way — and
// it USED to be here, which meant staff could pick "Refunded" from a dropdown,
// the customer would be told they'd been repaid, and no money would move.
// A refund now goes through /admin/refunds → the Paystack refund API → the
// refund.processed webhook → apply_refund_result() (016), which is the only
// thing that may write 'refunded'. The status records that money moved; it does
// not express an intention to move it.
const SETTABLE = ['processing', 'shipped', 'delivered', 'canceled']

// An unpaid order can only be cancelled — you can't fulfil something
// that was never paid for.
//
// 'refunded' appears in no list here: it isn't reachable by hand at all.
const ALLOWED_FROM = {
  pending: ['canceled'],
  paid: ['processing', 'shipped', 'delivered', 'canceled'],
  processing: ['shipped', 'delivered', 'canceled'],
  shipped: ['delivered'],
  delivered: [],
  canceled: [],
  refunded: [],
}

// GET /api/admin/orders/[id]
export async function GET(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    let customer = null
    if (order.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('id', order.user_id)
        .single()
      customer = profile || null
    }

    return NextResponse.json({
      data: {
        ...order,
        customer,
        allowedTransitions: ALLOWED_FROM[order.status] || [],
      },
    })
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
  }
}

// PATCH /api/admin/orders/[id] - fulfilment only.
// Whitelist: status, tracking_number, admin_notes. Money columns
// (total_amount, subtotal, tax_amount…) are NEVER writable here — the
// payment flow owns those.
export async function PATCH(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params
    const { data: body, response } = await parseAdminBody(
      request,
      OrderUpdateSchema
    )
    if (response) return response

    const { data: current, error: readError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', id)
      .single()

    if (readError || !current) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const patch = {}

    if (typeof body.tracking_number === 'string') {
      patch.tracking_number = body.tracking_number.trim().slice(0, 120) || null
    }
    if (typeof body.admin_notes === 'string') {
      patch.admin_notes = body.admin_notes.trim().slice(0, 2000) || null
    }

    if (typeof body.status === 'string' && body.status !== current.status) {
      const next = body.status

      if (next === 'paid' || next === 'pending') {
        return NextResponse.json(
          {
            error:
              "Payment status is set automatically when Paystack confirms the payment — it can't be changed by hand.",
          },
          { status: 400 }
        )
      }
      if (!SETTABLE.includes(next)) {
        return NextResponse.json({ error: 'That status is not valid.' }, { status: 400 })
      }

      const allowed = ALLOWED_FROM[current.status] || []
      if (!allowed.includes(next)) {
        return NextResponse.json(
          {
            error:
              current.status === 'pending'
                ? "This order hasn't been paid yet, so it can only be cancelled."
                : `You can't move an order from “${current.status}” to “${next}”.`,
          },
          { status: 400 }
        )
      }
      patch.status = next
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Tell the customer, but only on a real transition INTO shipped/delivered.
    // `current.status !== data.status` matters: staff editing a tracking number
    // on an already-shipped order must not re-send "your order is on its way".
    if (patch.status && current.status !== data.status && EMAIL_ON_STATUS[data.status]) {
      try {
        if (data.email) {
          const { subject, html, text } = EMAIL_ON_STATUS[data.status](data)
          await sendEmail({ to: data.email, subject, html, text })
        }
      } catch (e) {
        // The status change is saved and is what matters; a failed email must
        // not turn a successful fulfilment update into a 500 for staff.
        console.error('Order status email failed:', e.message)
      }
    }

    return NextResponse.json({
      data: { ...data, allowedTransitions: ALLOWED_FROM[data.status] || [] },
    })
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
