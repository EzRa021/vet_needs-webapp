import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/best-sellers?limit=8
//
// Reads through get_best_sellers() rather than the materialized view directly:
// the view holds units_sold per product, which is commercial information, and
// materialized views can't have RLS. The function returns rank without numbers.
export async function GET(request) {
  try {
    const limit = Math.min(
      Math.max(parseInt(new URL(request.url).searchParams.get('limit')) || 8, 1),
      24
    )

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_best_sellers', { p_limit: limit })

    if (error) {
      // Includes "function does not exist" before 015 has run. A missing rail is
      // a quieter home page; a 500 is a broken one.
      console.error('Best sellers fetch error:', error)
      return NextResponse.json({ data: [] })
    }

    // Reshape to match what ProductCard expects elsewhere (it reads
    // item.category?.name), so the rail can reuse the same card.
    const items = (data || []).map(({ category_name, ...item }) => ({
      ...item,
      category: category_name ? { name: category_name } : null,
    }))

    return NextResponse.json({ data: items })
  } catch (error) {
    console.error('Best sellers API error:', error)
    return NextResponse.json({ data: [] })
  }
}
