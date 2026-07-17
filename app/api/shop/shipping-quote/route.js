import { NextResponse } from 'next/server'

import { resolveShipping } from '@/lib/shipping'

// GET /api/shop/shipping-quote?state=Lagos
//
// Lets checkout show the real delivery fee as soon as the state is picked,
// rather than a flat guess the server then contradicts at order time.
//
// This is a QUOTE, not a commitment: create-order resolves the fee again from
// the state on the order. Same function, so they agree — but the browser's copy
// is never trusted.
export async function GET(request) {
  try {
    const state = (new URL(request.url).searchParams.get('state') || '').slice(0, 60)

    const { shippingFlat, freeShippingOver, zone } = await resolveShipping(state)

    return NextResponse.json({
      data: {
        fee: shippingFlat,
        free_over: freeShippingOver,
        zone_name: zone?.name || null,
        delivery_estimate: zone?.delivery_estimate || null,
      },
    })
  } catch (error) {
    console.error('Shipping quote API error:', error)
    return NextResponse.json({ error: 'Could not quote shipping' }, { status: 500 })
  }
}
