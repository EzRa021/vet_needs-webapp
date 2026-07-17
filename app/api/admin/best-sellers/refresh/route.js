import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/best-sellers/refresh
//
// Rebuilds the best_sellers materialized view (015). Exists because the refresh
// is deliberately NOT on the payment path — recomputing an aggregate over every
// order to confirm one payment would add latency and a failure mode to the one
// flow that must never wobble.
//
// Point a cron at this (or use pg_cron). Staff-gated rather than open: a refresh
// is cheap but not free, and an open endpoint is a free way to make it expensive.
export async function POST() {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Service role: refresh_best_sellers() is granted to service_role only —
    // rebuilding a view isn't something a customer session should ever do.
    const admin = createAdminClient()
    const { error } = await admin.rpc('refresh_best_sellers')

    if (error) {
      console.error('Best sellers refresh failed:', error)
      return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, refreshed_at: new Date().toISOString() })
  } catch (error) {
    console.error('Best sellers refresh API error:', error)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
