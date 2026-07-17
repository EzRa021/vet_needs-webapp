import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PLACEMENTS = ['home_hero', 'home_banner', 'shop_banner', 'popup']

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

    let query = supabase
      .from('promotions')
      .select('id, title, subtitle, image_url, link_url, placement, sort_order')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)

    if (placement && PLACEMENTS.includes(placement)) {
      query = query.eq('placement', placement)
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

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
