import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const EMPTY = { total: 0, price: { min: 0, max: 0 }, in_stock: 0, brands: [], attributes: [] }

// GET /api/shop/facets?category=&department=&search=
//
// The filter panel's options and counts, computed over the same scope as the
// grid (see 013). Deliberately does NOT take the facet selections themselves:
// counts describe "what's available here", so narrowing by brand must not make
// the other brands vanish from the panel the shopper is using.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const department = searchParams.get('department')
    const search = (searchParams.get('search') || '').slice(0, 100)

    // Category wins over department — same precedence as /api/shop/items.
    const node =
      category && category !== 'all'
        ? category
        : department && department !== 'all'
          ? department
          : null

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('shop_facets', {
      p_node: node,
      p_search: search || null,
    })

    if (error) {
      console.error('Facets fetch error:', error)
      // Empty facets = no filter panel. That's a worse shop, but a working one;
      // failing the request would take the product grid down with it.
      return NextResponse.json({ data: EMPTY })
    }

    return NextResponse.json({ data: data || EMPTY })
  } catch (error) {
    console.error('Facets API error:', error)
    return NextResponse.json({ data: EMPTY })
  }
}
