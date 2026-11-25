import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PLACEMENTS = ['home_hero', 'home_tile', 'home_banner', 'shop_banner', 'popup']

// GET /api/shop/promotions[?placement=home_hero]
// Public. Uses the anon/session client on purpose so the "live promotions
// readable" RLS policy does the filtering (active AND started AND not ended).
// The explicit filters below are belt-and-braces, not the security boundary.
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get('placement')

    const nowIso = new Date().toISOString()

    const run = (columns) => {
      let query = supabase
        .from('promotions')
        .select(columns)
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      if (placement && PLACEMENTS.includes(placement)) {
        query = query.eq('placement', placement)
      }
      return query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
    }

    // Newest columns first; a database that hasn't had 034/035 run yet just
    // gets the older shape, so promotions never vanish over a migration.
    const BASE = 'id, title, subtitle, image_url, link_url, placement, sort_order'
    const SHAPES = [`${BASE}, image_only, popup_repeat`, `${BASE}, image_only`, BASE]
    let data = null
    let error = null
    for (const columns of SHAPES) {
      ;({ data, error } = await run(columns))
      const missingColumn = error && (error.code === '42703' || /image_only|popup_repeat/.test(error.message || ''))
      if (!missingColumn) break
    }

    if (error) {
      console.error('Promotions fetch error:', error)
      return NextResponse.json({ error: 'Failed to load promotions' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Promotions API error:', error)
    return NextResponse.json({ error: 'Failed to load promotions' }, { status: 500 })
  }
}
