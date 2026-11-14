import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import {
  fallbackAlertRecipients,
  isEmailConfigured,
  orderAlertRecipients,
  sendTestOrderAlert,
} from '@/lib/email/staff-alerts'

// GET /api/admin/settings/order-alerts
// Where new-order emails go right now, and whether the server can send mail
// at all — the Settings page shows both under the field.
export async function GET() {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { recipients, source } = await orderAlertRecipients()
  return NextResponse.json({
    data: {
      recipients,
      source,
      fallback: fallbackAlertRecipients(),
      emailConfigured: isEmailConfigured(),
    },
  })
}

// POST /api/admin/settings/order-alerts — send a test alert to the saved
// recipients, using the real template and a sample order.
export async function POST() {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email isn't set up on the server. Add ZEPTOMAIL_TOKEN and EMAIL_FROM (or GMAIL_USER and GMAIL_APP_PASSWORD) to the hosting environment and redeploy.",
      },
      { status: 400 }
    )
  }

  const { recipients, results } = await sendTestOrderAlert()
  if (!recipients.length) {
    return NextResponse.json({ error: 'Add an order alert email and save it first.' }, { status: 400 })
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length === results.length) {
    return NextResponse.json(
      { error: `The email didn't send: ${failed[0]?.error || 'the mail server refused it'}.` },
      { status: 502 }
    )
  }
  return NextResponse.json({
    data: {
      sent: results.filter((r) => r.ok).map((r) => r.to),
      failed: failed.map((r) => ({ to: r.to, error: r.error })),
    },
  })
}
