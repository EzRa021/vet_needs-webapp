import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'

// GET /api/admin/refunds?status=requested
export async function GET(request) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabase } = auth
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'

    let query = supabase
      .from('refund_requests')
      .select(
        `id, order_id, email, reason, details, status, requested_amount,
         refunded_amount, paystack_refund_id, restock, admin_notes,
         created_at, processed_at,
         order:orders (id, total_amount, status, created_at, payment_reference, order_items)`,
        { count: 'exact' }
      )

    if (status !== 'all') query = query.eq('status', status)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Admin refunds fetch error:', error)
      return NextResponse.json({ error: 'Failed to load refunds' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Admin refunds API error:', error)
    return NextResponse.json({ error: 'Failed to load refunds' }, { status: 500 })
  }
}
