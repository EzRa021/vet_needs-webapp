import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyProductFilters, isLowStock, readProductFilters } from '@/lib/product-filters'

// GET /api/admin/products/summary?search=&category=
//
// Catalogue health for the Products page header, over the same search and
// category as the table (status is what the counts are FOR, so it's ignored):
//   counts    all / active / inactive / featured / low_stock / out_of_stock
//   gaps      products missing something that costs sales or skews reports:
//             no photo, no cost price (margins and stock value go blind),
//             no category (invisible when shoppers browse)
//
// One narrow read of the catalogue rather than a query per count: "low"
// compares two columns, which only JS can do anyway.
export async function GET(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const filters = readProductFilters(searchParams)

    // Service role: cost_price is revoked from the staff session (023).
    const admin = createAdminClient()
    const applied = await applyProductFilters(
      admin
        .from('items')
        .select('id, stock, low_stock_threshold, is_active, is_featured, image_url, cost_price, category_id')
        .limit(10000),
      filters,
      supabase
    )
    if (applied.error) {
      return NextResponse.json({ error: applied.error }, { status: 400 })
    }

    const { data, error } = await applied.query
    if (error) throw error
    const rows = data || []

    const count = (fn) => rows.reduce((n, r) => n + (fn(r) ? 1 : 0), 0)

    return NextResponse.json({
      data: {
        counts: {
          all: rows.length,
          active: count((r) => r.is_active),
          inactive: count((r) => !r.is_active),
          featured: count((r) => r.is_featured),
          low_stock: count(isLowStock),
          out_of_stock: count((r) => Number(r.stock) <= 0),
        },
        gaps: {
          no_image: count((r) => !r.image_url),
          no_cost: count((r) => r.cost_price === null || r.cost_price === undefined),
          uncategorised: count((r) => !r.category_id),
        },
      },
    })
  } catch (error) {
    console.error('Admin products summary error:', error)
    return NextResponse.json({ error: 'Failed to load product summary' }, { status: 500 })
  }
}
