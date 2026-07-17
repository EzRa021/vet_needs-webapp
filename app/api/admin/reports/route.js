import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'

// GET /api/admin/reports?from=ISO&to=ISO
//
// One call, four queries — the panels must describe the same window, and four
// round-trips that each parse their own dates is how a dashboard ends up with a
// summary that disagrees with its own chart.
//
// The RPCs are SECURITY DEFINER and check is_staff() themselves (017); this
// route's getStaffUser() is for a clean 403 rather than a raw SQL error.
export async function GET(request) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabase } = auth
    const { searchParams } = new URL(request.url)

    // Default: the last 30 days, ending at the start of tomorrow so today's
    // sales are included (`to` is exclusive in the RPCs).
    const now = new Date()
    const defaultTo = new Date(now)
    defaultTo.setHours(24, 0, 0, 0)
    const defaultFrom = new Date(defaultTo)
    defaultFrom.setDate(defaultFrom.getDate() - 30)

    const parse = (v, fallback) => {
      const d = v ? new Date(v) : null
      return d && !Number.isNaN(d.getTime()) ? d : fallback
    }

    const from = parse(searchParams.get('from'), defaultFrom)
    const to = parse(searchParams.get('to'), defaultTo)

    if (from >= to) {
      return NextResponse.json({ error: 'The start date must be before the end date' }, { status: 400 })
    }

    const args = { p_from: from.toISOString(), p_to: to.toISOString() }

    const [summary, byDay, products, categories] = await Promise.all([
      supabase.rpc('report_sales_summary', args),
      supabase.rpc('report_sales_by_day', args),
      supabase.rpc('report_top_products', { ...args, p_limit: 10 }),
      supabase.rpc('report_top_categories', { ...args, p_limit: 10 }),
    ])

    const failed = [summary, byDay, products, categories].find((r) => r.error)
    if (failed) {
      console.error('Reports error:', failed.error)
      return NextResponse.json({ error: 'Failed to build the report' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        range: { from: from.toISOString(), to: to.toISOString() },
        summary: summary.data,
        by_day: byDay.data || [],
        top_products: products.data || [],
        top_categories: categories.data || [],
      },
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Failed to build the report' }, { status: 500 })
  }
}
