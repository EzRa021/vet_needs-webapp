import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/search-suggest?q=lay
//
// Powers the header autocomplete. Returns products (ranked, prefix-matched via
// the search_items RPC from 012) and matching categories, because "Poultry
// Feeds" is often what the shopper actually wants — jumping them to the
// category beats showing four of its products.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim().slice(0, 60)

    // Below two characters every query matches half the catalogue; the
    // suggestions are noise and it's a needless round-trip per keystroke.
    if (q.length < 2) {
      return NextResponse.json({ data: { items: [], categories: [] } })
    }

    const supabase = await createClient()

    const [itemsRes, catsRes] = await Promise.all([
      supabase.rpc('search_items', { p_query: q, p_limit: 6 }),
      // Categories are few and shallow, so ilike is genuinely fine here —
      // no tsvector needed for a table this size.
      supabase
        .from('categories')
        .select('id, name, image_url, parent_id')
        .eq('is_active', true)
        .ilike('name', `%${q.replace(/[%_]/g, ' ')}%`)
        .limit(3),
    ])

    if (itemsRes.error) {
      console.error('search-suggest items error:', itemsRes.error)
    }
    if (catsRes.error) {
      console.error('search-suggest categories error:', catsRes.error)
    }

    // A failure on either half returns the other rather than a 500: half a
    // suggestion list is more useful than none, and this is a typeahead.
    return NextResponse.json({
      data: {
        items: itemsRes.data || [],
        categories: catsRes.data || [],
      },
    })
  } catch (error) {
    console.error('search-suggest API error:', error)
    return NextResponse.json({ data: { items: [], categories: [] } })
  }
}
