import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORDER_STATUSES } from '@/lib/order-status'
import { ORDER_SORTS, applyOrderFilters, readOrderFilters } from '@/lib/order-filters'

// Everything the live table renders, including the expandable row. Money
// columns are read-only here — the payment flow owns them.
const LIST_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'paid_at',
  'status',
  'currency',
  'subtotal',
  'shipping_fee',
  'tax_amount',
  'discount_amount',
  'coupon_code',
  'total_amount',
  'order_items',
  'shipping_address',
  'tracking_number',
  'payment_reference',
  'user_id',
  'email',
  'notes',
  'admin_notes',
  'fulfilment_method',
  'delivery',
  'pickup_code',
].join(', ')

// GET /api/admin/orders?search=&status=&range=&sort=&page=&limit=
//   range: today | 7d | 30d | all   (Lagos calendar days)
//   sort:  newest | oldest | total_desc | total_asc   (default newest)
export async function GET(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const filters = readOrderFilters(searchParams)
    const status = searchParams.get('status') || 'all'
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 20, 1), 100)
    const offset = (page - 1) * limit

    // Service role for the read: admin_notes is hidden from the client roles
    // (027), and the expandable row shows it. getStaffUser() above is the gate.
    const admin = createAdminClient()
    let query = admin.from('orders').select(LIST_COLUMNS, { count: 'exact' })
    query = applyOrderFilters(query, filters)
    if (status !== 'all' && ORDER_STATUSES.includes(status)) {
      query = query.eq('status', status)
    }

    // Newest first by default. created_at is the tiebreaker for total sorts so
    // equal totals don't shuffle between refreshes; id makes it total.
    const sort = ORDER_SORTS[filters.sort]
    query = query.order(sort.column, { ascending: sort.ascending })
    if (sort.column !== 'created_at') query = query.order('created_at', { ascending: false })
    query = query.order('id', { ascending: false })

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    // orders.user_id → auth.users, and profiles.id → auth.users, but there is
    // no direct FK between orders and profiles, so PostgREST can't embed it.
    // Fetch the names in one extra query and merge.
    const userIds = [...new Set((data || []).map((o) => o.user_id).filter(Boolean))]
    let profiles = new Map()
    if (userIds.length) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds)
      profiles = new Map((profileRows || []).map((p) => [p.id, p]))
    }

    const rows = (data || []).map((o) => {
      const items = Array.isArray(o.order_items) ? o.order_items : []
      const profile = profiles.get(o.user_id)
      return {
        ...o,
        itemCount: items.reduce((n, i) => n + Number(i.quantity || 0), 0),
        lineCount: items.length,
        customerName: profile?.full_name || null,
        customerPhone: profile?.phone || null,
        isGuest: !o.user_id,
      }
    })

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
