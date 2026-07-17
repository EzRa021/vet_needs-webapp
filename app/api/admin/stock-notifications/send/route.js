import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { backInStockEmail } from '@/lib/email/templates'

// POST /api/admin/stock-notifications/send
//
// Drains the ready queue (022). Deliberately NOT called from the stock write:
// a mail provider having a bad afternoon must never be able to fail an
// inventory update. Point a cron at this — every 5–15 minutes is plenty; the
// value of "back in stock" decays in hours, not seconds.
//
// Staff-gated like the best-sellers refresh: cheap, but not free, and an open
// endpoint is a free way to make it expensive.
export async function POST() {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = createAdminClient()

    const { data: rows, error } = await admin
      .from('stock_notifications')
      .select('id, item_id, email, notify_by, item:items (id, name, price, unit_type, stock, allow_backorder, is_active)')
      .eq('status', 'ready')
      // Fairness: whoever asked first hears first. On a small restock that's the
      // difference between a waiting list and a lottery.
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('Stock notifications read failed:', error)
      return NextResponse.json({ error: 'Could not read the queue' }, { status: 500 })
    }

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const row of rows || []) {
      const item = row.item

      // It sold out again between the restock and this run. Sending "it's back"
      // to someone who'll land on an Out of Stock button is worse than silence
      // — leave it pending so the NEXT restock catches them.
      const buyable =
        item?.is_active &&
        (item.allow_backorder || item.stock === null || Number(item.stock) > 0)

      if (!buyable) {
        await admin
          .from('stock_notifications')
          .update({ status: 'pending', ready_at: null })
          .eq('id', row.id)
        skipped++
        continue
      }

      // Only email can deliver today. WhatsApp rows stay `ready` rather than
      // being marked sent — a queue that lies about what it delivered is worse
      // than one that's visibly waiting for a sender.
      if (row.notify_by !== 'email' || !row.email) {
        skipped++
        continue
      }

      const { subject, html, text } = backInStockEmail(item)
      const result = await sendEmail({ to: row.email, subject, html, text })

      if (result.ok) {
        await admin
          .from('stock_notifications')
          .update({ status: 'sent', notified_at: new Date().toISOString() })
          .eq('id', row.id)
        sent++
      } else if (result.skipped) {
        // No RESEND_API_KEY. Leave it ready — this is "not configured yet", not
        // "failed", and marking it sent would silently drop the waiting list.
        skipped++
      } else {
        await admin.from('stock_notifications').update({ status: 'failed' }).eq('id', row.id)
        failed++
      }
    }

    return NextResponse.json({ data: { sent, skipped, failed, considered: rows?.length || 0 } })
  } catch (error) {
    console.error('Stock notifications send error:', error)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
