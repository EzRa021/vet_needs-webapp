import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/items/[id] - Get single item
export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('items')
      // Explicit FK — item_categories makes a bare embed ambiguous (PGRST201)
      .select(
        '*, category:categories!items_category_id_fkey(id, name, path), images:item_images(url, alt_text, sort_order)'
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
