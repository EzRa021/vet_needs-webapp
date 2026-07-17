import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled', 'refunded']

// GET /api/admin/orders?search=&status=&page=&limit=
export async function GET(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim().slice(0, 100)
    const status = searchParams.get('status') || 'all'
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 20, 1), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('orders')
      .select(
        'id, created_at, status, total_amount, currency, order_items, shipping_address, tracking_number, payment_reference, user_id',
        { count: 'exact' }
      )

    if (status !== 'all' && STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    // Search by order id prefix, tracking number, or anything in the address
    // blob (which carries the customer's name, email and phone).
    if (search) {
      const safe = search.replace(/[,()\\%_]/g, ' ').trim()
      if (safe) {
        query = query.or(
          `shipping_address.ilike.*${safe}*,tracking_number.ilike.*${safe}*,payment_reference.ilike.*${safe}*`
        )
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // orders.user_id → auth.users, and profiles.id → auth.users, but there is
    // no direct FK between orders and profiles, so PostgREST can't embed it.
    // Fetch the names in one extra query and merge.
    const userIds = [...new Set((data || []).map((o) => o.user_id).filter(Boolean))]
    let profiles = new Map()
    if (userIds.length) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      profiles = new Map((profileRows || []).map((p) => [p.id, p]))
    }

    const rows = (data || []).map((o) => ({
      ...o,
      itemCount: Array.isArray(o.order_items)
        ? o.order_items.reduce((n, i) => n + Number(i.quantity || 0), 0)
        : 0,
      customerName: profiles.get(o.user_id)?.full_name || null,
    }))

    return NextResponse.json({
      data: rows,
      pagination: {
        total: count || 0,
        page,
        pages: Math.ceil((count || 0) / limit),
        limit,
      },
    })
  } catch (error) {
    console.error('Admin orders error:', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
