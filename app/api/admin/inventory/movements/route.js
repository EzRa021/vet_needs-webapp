import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'

// GET /api/admin/inventory/movements?limit=&scope=stock|all
//
// The newest item_history rows across the whole catalogue, for the live
// "Stock activity" feed: sales, restocks and adjustments (scope=stock, the
// default) or every change including price and VAT edits (scope=all).
//
// Read with the staff session: "staff read item history" (003) allows it, and
// nothing here touches cost_price — the embed only takes name, SKU, unit and
// photo, which are public columns.
export async function GET(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 30, 1), 100)
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'stock'

    let query = supabase
      .from('item_history')
      .select('id, item_id, type, created_by, details, created_at, item:items(id, name, sku, unit_type, image_url)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (scope === 'stock') query = query.in('type', ['sale', 'restock', 'adjustment'])

    const { data, error } = await query
    if (error) throw error

    // created_by is an auth uid for staff actions, or 'system'/'webhook'.
    // Resolve the uids to names so the feed says who did it.
    const uids = [
      ...new Set(
        (data || [])
          .map((r) => r.created_by)
          .filter((v) => /^[0-9a-f-]{36}$/i.test(v || ''))
      ),
    ]
    let names = new Map()
    if (uids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', uids)
      names = new Map((profiles || []).map((p) => [p.id, p.full_name]))
    }

    return NextResponse.json({
      data: (data || []).map((r) => ({
        ...r,
        actor: names.get(r.created_by) || (r.created_by === 'system' || r.created_by === 'webhook' ? null : 'Staff'),
      })),
    })
  } catch (error) {
    console.error('Inventory movements error:', error)
    return NextResponse.json({ error: 'Failed to load stock activity' }, { status: 500 })
  }
}
