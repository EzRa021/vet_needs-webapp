import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'

const DAY = 24 * 60 * 60 * 1000
const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered']

// GET /api/admin/stats - dashboard overview: KPIs, 30d-vs-previous-30d
// deltas, and a daily revenue/orders series for the trend chart.
export async function GET() {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const now = Date.now()
    const start30 = new Date(now - 30 * DAY)
    const start60 = new Date(now - 60 * DAY)

    // Pull 60 days once, then split into current/previous in JS.
    const [paid, products, lowStock, recent] = await Promise.all([
      supabase
        .from('orders')
        .select('total_amount, created_at')
        .in('status', PAID_STATUSES)
        .gte('created_at', start60.toISOString()),
      supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('items')
        .select('id, name, stock, unit_type, low_stock_threshold')
        .eq('is_active', true)
        .order('stock', { ascending: true })
        .limit(8),
      supabase
        .from('orders')
        .select('id, created_at, status, total_amount')
        .order('created_at', { ascending: false })
        .limit(6),
    ])

    if (paid.error) throw paid.error

    const orders = paid.data || []
    const current = orders.filter((o) => new Date(o.created_at) >= start30)
    const previous = orders.filter((o) => new Date(o.created_at) < start30)

    const sum = (rows) =>
      Math.round(rows.reduce((s, o) => s + Number(o.total_amount || 0), 0) * 100) / 100

    const revenue30d = sum(current)
    const revenuePrev = sum(previous)
    const orders30d = current.length
    const ordersPrev = previous.length

    // Daily buckets for the last 30 days (zero-filled so the line is continuous)
    const buckets = new Map()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY)
      buckets.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 })
    }
    for (const o of current) {
      const key = new Date(o.created_at).toISOString().slice(0, 10)
      const b = buckets.get(key)
      if (b) {
        b.revenue += Number(o.total_amount || 0)
        b.orders += 1
      }
    }
    const series = [...buckets.entries()].map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue * 100) / 100,
      orders: v.orders,
    }))

    const { count: pendingCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    const lowStockItems = (lowStock.data || []).filter(
      (i) => Number(i.stock) <= Number(i.low_stock_threshold ?? 10)
    )

    // null delta = no prior data to compare against (don't fake "+100%")
    const pctChange = (cur, prev) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null

    return NextResponse.json({
      data: {
        revenue30d,
        orders30d,
        pendingOrders: pendingCount || 0,
        activeProducts: products.count || 0,
        deltas: {
          revenue: pctChange(revenue30d, revenuePrev),
          orders: pctChange(orders30d, ordersPrev),
        },
        avgOrderValue: orders30d > 0 ? Math.round((revenue30d / orders30d) * 100) / 100 : 0,
        series,
        lowStock: lowStockItems,
        recentOrders: recent.data || [],
      },
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
