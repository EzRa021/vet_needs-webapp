import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/inventory
//
// Stock valuation + what-to-reorder. Reads cost_price, so it goes through the
// service role behind the staff gate (023 hid cost_price from every client
// role — this is one of the few places allowed to see it).
export async function GET() {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('items')
      .select(
        'id, name, sku, stock, cost_price, price, low_stock_threshold, allow_backorder, unit_type, is_active, category:categories!items_category_id_fkey(name)'
      )
      .order('name')

    if (error) {
      console.error('Inventory read failed:', error)
      return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
    }

    let costValue = 0 // what the stock cost us
    let retailValue = 0 // what it would sell for
    let outOfStock = 0
    let lowStock = 0
    let missingCost = 0 // in-stock items with no cost_price → valuation understated
    let untracked = 0 // stock is null (not inventory-managed)

    const rows = (data || []).map((i) => {
      const tracked = i.stock !== null && i.stock !== undefined
      const stock = tracked ? Number(i.stock) : null
      const cost = i.cost_price === null || i.cost_price === undefined ? null : Number(i.cost_price)
      const price = Number(i.price)
      const threshold = Number(i.low_stock_threshold ?? 10)

      // "Buyable" mirrors the storefront: backorder or untracked counts as in
      // stock, so this agrees with what customers actually see.
      const out = tracked && !i.allow_backorder && stock <= 0
      const low = tracked && !out && stock > 0 && stock <= threshold

      if (!tracked) untracked++
      if (out) outOfStock++
      if (low) lowStock++

      const stockCost = tracked && cost !== null ? stock * cost : 0
      const stockRetail = tracked ? stock * price : 0

      if (tracked && stock > 0 && cost === null) missingCost++

      costValue += stockCost
      retailValue += stockRetail

      return {
        id: i.id,
        name: i.name,
        sku: i.sku,
        category: i.category?.name || null,
        stock,
        unit_type: i.unit_type,
        cost,
        price,
        threshold,
        stock_cost: Math.round(stockCost * 100) / 100,
        status: !tracked ? 'untracked' : out ? 'out' : low ? 'low' : 'ok',
        is_active: i.is_active,
      }
    })

    return NextResponse.json({
      data: {
        rows,
        totals: {
          products: rows.length,
          cost_value: Math.round(costValue * 100) / 100,
          retail_value: Math.round(retailValue * 100) / 100,
          // Unrealised margin if every unit in stock sold at list price.
          potential_margin: Math.round((retailValue - costValue) * 100) / 100,
          out_of_stock: outOfStock,
          low_stock: lowStock,
          missing_cost: missingCost,
          untracked,
        },
      },
    })
  } catch (error) {
    console.error('Inventory API error:', error)
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
  }
}
