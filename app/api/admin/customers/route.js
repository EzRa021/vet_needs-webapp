import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const PAID = ['paid', 'processing', 'shipped', 'delivered']

// GET /api/admin/customers?search=&role=&page=&limit=
// Admin-only: this exposes every user's email and lifetime spend.
export async function GET(request) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim().slice(0, 100)
    const role = searchParams.get('role') || 'all'
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 20, 1), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at', { count: 'exact' })

    if (['customer', 'staff', 'admin'].includes(role)) {
      query = query.eq('role', role)
    }
    if (search) {
      const safe = search.replace(/[,()\\%_]/g, ' ').trim()
      if (safe) query = query.or(`full_name.ilike.*${safe}*,phone.ilike.*${safe}*`)
    }

    const { data: profiles, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const ids = (profiles || []).map((p) => p.id)

    // Emails live in auth.users, which PostgREST doesn't expose. The admin
    // client (service role) is the only way to read them — this route is
    // already gated to admins above.
    let emails = new Map()
    if (ids.length) {
      try {
        const admin = createAdminClient()
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        emails = new Map((list?.users || []).map((u) => [u.id, u.email]))
      } catch (e) {
        console.warn('Could not read auth emails:', e.message)
      }
    }

    // Lifetime spend + order count per customer
    let stats = new Map()
    if (ids.length) {
      const { data: orders } = await supabase
        .from('orders')
        .select('user_id, total_amount, status, created_at')
        .in('user_id', ids)

      for (const o of orders || []) {
        const s = stats.get(o.user_id) || { orders: 0, spend: 0, lastOrder: null }
        s.orders += 1
        if (PAID.includes(o.status)) s.spend += Number(o.total_amount || 0)
        if (!s.lastOrder || new Date(o.created_at) > new Date(s.lastOrder)) {
          s.lastOrder = o.created_at
        }
        stats.set(o.user_id, s)
      }
    }

    const rows = (profiles || []).map((p) => {
      const s = stats.get(p.id) || { orders: 0, spend: 0, lastOrder: null }
      return {
        ...p,
        email: emails.get(p.id) || null,
        orderCount: s.orders,
        lifetimeSpend: Math.round(s.spend * 100) / 100,
        lastOrderAt: s.lastOrder,
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
    console.error('Admin customers error:', error)
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 })
  }
}
