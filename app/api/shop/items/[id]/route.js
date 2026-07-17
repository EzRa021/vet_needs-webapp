import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/items/[id] - Get single item
export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('items')
      // Explicit columns (not '*'): 023 revoked cost_price from anon, so '*'
      // would now error — and this guarantees margins never reach a product
      // page. Explicit FK on the category embed avoids the item_categories
      // ambiguity (PGRST201).
      .select(
        `id, name, slug, sku, brand, description, long_description, price,
         compare_at_price, unit_type, stock, low_stock_threshold, allow_backorder,
         is_active, is_available, is_featured, image_url, rating_avg, rating_count,
         weight_grams, attributes, tags, meta_title, meta_description, category_id,
         created_at, updated_at, vat_enabled, vat_rate, vat_inclusive,
         category:categories!items_category_id_fkey(id, name, path),
         images:item_images(url, alt_text, sort_order)`
      )
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Item fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Item API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
