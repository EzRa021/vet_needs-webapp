import { NextResponse } from 'next/server'

import { loadDeliveryOptions } from '@/lib/delivery-server'

// GET /api/shop/delivery-options
//
// The checkout's delivery choices: active pickup points and, while area
// pricing is on, the priced areas grouped by city. Prices themselves come from
// /api/shop/delivery-quote, because they depend on the cart's weight.
export async function GET() {
  try {
    const data = await loadDeliveryOptions()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Delivery options API error:', error)
    return NextResponse.json({ error: 'Could not load delivery options' }, { status: 500 })
  }
}
