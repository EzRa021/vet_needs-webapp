import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { ORDER_STATUSES, PAID_STATUSES } from '@/lib/order-status'
import { applyOrderFilters, lagosStartOfToday, readOrderFilters } from '@/lib/order-filters'

// A paid order that hasn't moved for this long is flagged as waiting.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

// GET /api/admin/orders/summary?search=&range=
//
// Two things the Orders page header needs, and nothing it doesn't:
//   counts — one per status over the same search + range as the table, so
//            clicking a count shows exactly that many rows
//   today  — orders, paid revenue and average basket since Lagos midnight,
//            regardless of filters (it's the "how's the day going" line)
//   stale  — paid orders still not picked up after 24h, regardless of filters
export async function GET(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const filters = readOrderFilters(searchParams)

    // head: true → count only, no rows. One small query per status beats
    // pulling every order to count it in JS.
    const countFor = (status) =>
      applyOrderFilters(
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        filters
      ).eq('status', status)

    const todayStart = lagosStartOfToday().toISOString()
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString()

    const [countResults, todayResult, staleResult] = await Promise.all([
      Promise.all(ORDER_STATUSES.map((s) => countFor(s))),
      supabase.from('orders').select('status, total_amount').gte('created_at', todayStart),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'paid')
        .lt('paid_at', staleBefore),
    ])

    const failed = countResults.find((r) => r.error) || (todayResult.error && todayResult) || (staleResult.error && staleResult)
    if (failed) throw failed.error

    const counts = Object.fromEntries(
      ORDER_STATUSES.map((s, i) => [s, countResults[i].count || 0])
    )
    counts.all = ORDER_STATUSES.reduce((n, s) => n + counts[s], 0)

    const todayRows = todayResult.data || []
    const paidToday = todayRows.filter((o) => PAID_STATUSES.includes(o.status))
    const revenue = paidToday.reduce((n, o) => n + Number(o.total_amount || 0), 0)

    return NextResponse.json({
      data: {
        counts,
        today: {
          orders: todayRows.length,
          paidOrders: paidToday.length,
          revenue,
          averageOrder: paidToday.length ? revenue / paidToday.length : 0,
          awaitingPayment: todayRows.filter((o) => o.status === 'pending').length,
        },
        stale: staleResult.count || 0,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Admin orders summary error:', error)
    return NextResponse.json({ error: 'Failed to load order summary' }, { status: 500 })
  }
}
