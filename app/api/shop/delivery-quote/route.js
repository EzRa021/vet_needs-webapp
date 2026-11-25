import { NextResponse } from 'next/server'

import { isUuid } from '@/lib/delivery'
import { publicQuote, quoteDelivery } from '@/lib/delivery-server'

// POST /api/shop/delivery-quote
// Body: { method: 'delivery' | 'pickup', areaId, pickupPointId }
//
// A QUOTE, not a commitment: create-order works the fee out again with the
// same quoteDelivery(), so they agree. The fee depends only on the area (door
// delivery) or the store (pickup), not on the cart — the free-delivery
// threshold is applied to the cart in the browser and again by create-order.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    const quote = await quoteDelivery({
      method: body?.method === 'pickup' ? 'pickup' : 'delivery',
      areaId: isUuid(body?.areaId) ? body.areaId : null,
      pickupPointId: isUuid(body?.pickupPointId) ? body.pickupPointId : null,
    })
    return NextResponse.json({ data: publicQuote(quote) })
  } catch (error) {
    console.error('Delivery quote API error:', error)
    return NextResponse.json({ error: 'Could not work out delivery' }, { status: 500 })
  }
}
