import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { netPrice } from '@/lib/stock-movements'

const VELOCITY_DAYS = 30
const round2 = (n) => Math.round(n * 100) / 100

// GET /api/admin/inventory
//
// Stock valuation + what-to-reorder. Reads cost_price, so it goes through the
// service role behind the staff gate (023 hid cost_price from every client
// role — this is one of the few places allowed to see it).
//
// Per product it also works out how fast it's selling (units sold through the
// shop over the last 30 days, from item_history 'sale' rows) and so roughly
// how many days the current stock will last. That's what turns "12 left" into
// "12 left, about 4 days at this rate", which is the number a reorder hangs on.
export async function GET() {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = createAdminClient()
    const since = new Date(Date.now() - VELOCITY_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const [itemsResult, salesResult] = await Promise.all([
      admin
        .from('items')
        .select(
          'id, name, sku, stock, cost_price, price, vat_enabled, vat_rate, vat_inclusive, low_stock_threshold, allow_backorder, unit_type, is_active, image_url, updated_at, category_id, category:categories!items_category_id_fkey(name)'
        )
        .order('name'),
      // Staff session is enough here: "staff read item history" (003).
      auth.supabase
        .from('item_history')
        .select('item_id, change:details->changeAmount')
        .eq('type', 'sale')
        .gte('created_at', since)
        .limit(20000),
    ])

    if (itemsResult.error) {
      console.error('Inventory read failed:', itemsResult.error)
      return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
    }
    // Sales velocity is a nice-to-have; the valuation stands without it.
    if (salesResult.error) console.error('Inventory sales read failed:', salesResult.error)

    const soldById = new Map()
    for (const s of salesResult.data || []) {
      const qty = Math.abs(Number(s.change) || 0)
      soldById.set(s.item_id, (soldById.get(s.item_id) || 0) + qty)
    }

    let costValue = 0 // what the stock cost us
    let retailValue = 0 // what it would sell for
    let netValue = 0 // the same, without VAT — what margin is measured against
    let outOfStock = 0
    let lowStock = 0
    let missingCost = 0 // in-stock items with no cost_price → valuation understated
    let untracked = 0 // stock is null (not inventory-managed)

    const rows = (itemsResult.data || []).map((i) => {
      const tracked = i.stock !== null && i.stock !== undefined
      const stock = tracked ? Number(i.stock) : null
      const cost = i.cost_price === null || i.cost_price === undefined ? null : Number(i.cost_price)
      const price = Number(i.price)
      const net = netPrice(i)
      const threshold = Number(i.low_stock_threshold ?? 10)

      // Physical stock, not buyability: a backorder product at 0 is still out
      // on the shelf and still needs reordering. The UI says when backorders
      // keep it on sale anyway.
      const out = tracked && stock <= 0
      const low = tracked && !out && stock <= threshold

      if (!tracked) untracked++
      if (out) outOfStock++
      if (low) lowStock++

      const inHand = tracked ? Math.max(stock, 0) : 0
      const stockCost = cost !== null ? inHand * cost : 0
      const stockRetail = inHand * price

      if (tracked && stock > 0 && cost === null) missingCost++

      costValue += stockCost
      retailValue += stockRetail
      if (cost !== null) netValue += inHand * net

      const sold = soldById.get(i.id) || 0
      const perDay = sold / VELOCITY_DAYS

      return {
        id: i.id,
        name: i.name,
        sku: i.sku,
        image_url: i.image_url,
        category: i.category?.name || null,
        category_id: i.category_id,
        stock,
        unit_type: i.unit_type,
        cost,
        price,
        net_price: round2(net),
        vat_enabled: i.vat_enabled,
        vat_inclusive: i.vat_inclusive,
        vat_rate: i.vat_rate,
        threshold,
        allow_backorder: i.allow_backorder,
        stock_cost: round2(stockCost),
        stock_retail: round2(stockRetail),
        margin_percent: cost !== null && net > 0 ? round2(((net - cost) / net) * 100) : null,
        sold_30d: round2(sold),
        // null when nothing sold: "infinite days" isn't a number anyone can use.
        days_of_cover: tracked && perDay > 0 ? Math.floor(inHand / perDay) : null,
        status: !tracked ? 'untracked' : out ? 'out' : low ? 'low' : 'ok',
        is_active: i.is_active,
        updated_at: i.updated_at,
      }
    })

    return NextResponse.json({
      data: {
        rows,
        totals: {
          products: rows.length,
          cost_value: round2(costValue),
          retail_value: round2(retailValue),
          // Unrealised margin if every unit in stock sold at list price, VAT
          // taken out first, over the products whose cost is known.
          potential_margin: round2(netValue - costValue),
          out_of_stock: outOfStock,
          low_stock: lowStock,
          healthy: rows.length - outOfStock - lowStock - untracked,
          missing_cost: missingCost,
          untracked,
          velocity_days: VELOCITY_DAYS,
        },
      },
    })
  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
  }
}
