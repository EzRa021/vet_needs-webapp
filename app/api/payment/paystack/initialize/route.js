import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/payment/paystack/initialize - Initialize Paystack payment
// SECURITY: requires login; the order must belong to the caller, and the amount
// comes from the order row rather than the request body.
//
// That last part only means something because migration 009 took away the
// customer's ability to write to orders. Before it, `total_amount` was
// client-writable and this route would faithfully charge whatever the customer
// had put there.
export async function POST(request) {
  try {
    const supabase = await createClient()

    // Guests may pay too (011). Identity comes from the session when there is
    // one, and from the order's guest_token when there isn't.
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { orderId, guestToken } = body
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // Read with the service role, then prove ownership explicitly below. A
    // guest has no RLS select path to their own order by design — the token is
    // the capability, and it is checked here rather than assumed.
    const admin = createAdminClient()
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, user_id, email, guest_token, total_amount, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // "Not yours" and "doesn't exist" get the same answer: an order id must not
    // be a probe for whether someone else's order exists.
    const isOwner = user && order.user_id === user.id
    const isGuestWithToken =
      !order.user_id && !!guestToken && order.guest_token === guestToken

    if (!isOwner && !isGuestWithToken) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Order is not payable' }, { status: 400 })
    }

    // Unique reference per payment attempt (Paystack references are single-use)
    const reference = `${order.id}-${Date.now()}`

    // Save the reference on the order so verify/webhook can find it.
    //
    // Written with the service role, NOT the caller's session: migration 009
    // removed the customer's update policy on orders. That policy existed for
    // exactly this write, but RLS can't restrict columns — so it also let a
    // customer PATCH total_amount to 1 and pay ₦1 for anything. Ownership was
    // proved above; `status` is re-checked here so a webhook that lands between
    // the read and this write can't be overwritten.
    const { error: refError } = await admin
      .from('orders')
      .update({ payment_reference: reference })
      .eq('id', order.id)
      .eq('status', 'pending')

    if (refError) {
      console.error('Save payment reference error:', refError)
      return NextResponse.json({ error: 'Failed to start payment' }, { status: 500 })
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Paystack requires an email; for a guest it's the one they gave at
        // checkout, which create-order stored on the order.
        email: user?.email || order.email,
        amount: Math.round(Number(order.total_amount) * 100), // NGN → kobo
        currency: 'NGN',
        reference,
        // Paying is a full round-trip out to Paystack and back, so the tab
        // reloads and checkoutStore (not persisted) is wiped. A guest's token
        // has to survive that or they land on their own receipt unable to read
        // it — so it rides in the callback URL. Paystack appends ?reference=…,
        // hence the & here.
        callback_url: isGuestWithToken
          ? `${process.env.NEXT_PUBLIC_APP_URL}/checkout/verify?t=${order.guest_token}`
          : `${process.env.NEXT_PUBLIC_APP_URL}/checkout/verify`,
        metadata: { orderId: order.id },
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.status) {
      return NextResponse.json(
        { error: data.message || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      status: 'success',
      data: {
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference,
      },
    })
  } catch (error) {
    console.error('Paystack initialization error:', error)
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 })
  }
}
