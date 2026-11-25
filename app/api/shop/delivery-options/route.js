import { NextResponse } from 'next/server'

import { loadDeliveryOptions } from '@/lib/delivery-server'

// GET /api/shop/delivery-options
//
// The checkout's delivery choices (029, 031): which ways are switched on,
// every state with how it's priced, the areas (with door-delivery price and
// pickup store) and the active stores. create-order prices the order again on
// the server.
export async function GET() {
  try {
    const data = await loadDeliveryOptions()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Delivery options API error:', error)
    return NextResponse.json({ error: 'Could not load delivery options' }, { status: 500 })
  }
}
