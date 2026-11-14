import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { isUuid, parseAreaKey } from '@/lib/delivery'
import { publicQuote, quoteDelivery } from '@/lib/delivery-server'

// POST /api/shop/delivery-quote
// Body: { items: [{ id, quantity }], method, pickupPointId, state, areaKey, city }
//
// A QUOTE, not a commitment: create-order works the fee out again with the
// same quoteDelivery(), from the catalogue, so they agree. The weight is read
// from the catalogue here too — a cart in localStorage may be weeks old.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : []

    const wanted = new Map()
    for (const item of items) {
      const quantity = Number(item?.quantity)
      if (!isUuid(item?.id) || !Number.isFinite(quantity) || quantity <= 0) continue
      wanted.set(item.id, Math.min(quantity, 999))
    }

    let lines = []
    if (wanted.size) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('items')
        .select('id, name, unit_type, weight_grams')
        .in('id', [...wanted.keys()])
      if (error) throw error
      lines = (data || []).map((row) => ({ ...row, quantity: wanted.get(row.id) }))
    }

    const { areaId, unlistedCity } = parseAreaKey(body?.areaKey)
    const quote = await quoteDelivery({
      method: body?.method === 'pickup' ? 'pickup' : 'delivery',
      pickupPointId: isUuid(body?.pickupPointId) ? body.pickupPointId : null,
      state: typeof body?.state === 'string' ? body.state : null,
      areaId,
      unlistedCity,
      city: typeof body?.city === 'string' ? body.city : null,
      lines,
    })

    return NextResponse.json({ data: publicQuote(quote) })
  } catch (error) {
    console.error('Delivery quote API error:', error)
    return NextResponse.json({ error: 'Could not work out delivery' }, { status: 500 })
  }
}
