import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, SettingsUpdateSchema } from '@/lib/validation/admin'
import { invalidateSettingsCache } from '@/lib/settings'
import { MAX_ALERT_RECIPIENTS } from '@/lib/email/staff-alerts'

// Only these keys are editable from the admin. Anything else in the request
// is ignored, so a tampered body can't invent new settings rows.
const EDITABLE = {
  store_name: { type: 'string', label: 'Store name' },
  currency: { type: 'string', label: 'Currency', readOnly: true },
  shipping_flat_fee: { type: 'number', label: 'Flat shipping fee' },
  vat_rate: { type: 'number', label: 'Default VAT rate' },
  support_email: { type: 'string', label: 'Support email' },
  support_phone: { type: 'string', label: 'Support phone' },
  free_shipping_threshold: { type: 'number', label: 'Free shipping over', nullable: true },
  // 029: switched from the Delivery page.
  doorstep_delivery_enabled: { type: 'boolean', label: 'Door delivery' },
  store_pickup_enabled: { type: 'boolean', label: 'Store pickup' },
  // Private (never is_public): who gets new-order emails. Read by
  // lib/email/staff-alerts.js with the service role.
  order_alert_email: { type: 'emails', label: 'Order alert email' },
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

// GET /api/admin/settings
export async function GET() {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { data, error } = await auth.supabase
      .from('settings')
      .select('key, value, description, is_public, updated_at')
      .order('key', { ascending: true })
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Admin settings error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

// PATCH /api/admin/settings  Body: { values: { key: value } }
export async function PATCH(request) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { data: body, response } = await parseAdminBody(
      request,
      SettingsUpdateSchema
    )
    if (response) return response
    const values = body.values

    const updates = []
    for (const [key, raw] of Object.entries(values)) {
      const spec = EDITABLE[key]
      if (!spec || spec.readOnly) continue

      let value
      if (spec.type === 'emails') {
        // One or more addresses, comma-separated. Reject a typo rather than
        // silently dropping it: a mistyped alert address means missed orders.
        const parts = String(raw ?? '')
          .split(/[,;\s]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
        const bad = parts.find((p) => !EMAIL.test(p))
        if (bad) {
          return NextResponse.json(
            { error: `${spec.label}: “${bad.slice(0, 80)}” isn't a valid email address.` },
            { status: 400 }
          )
        }
        const unique = [...new Set(parts)]
        if (unique.length > MAX_ALERT_RECIPIENTS) {
          return NextResponse.json(
            { error: `${spec.label}: up to ${MAX_ALERT_RECIPIENTS} addresses.` },
            { status: 400 }
          )
        }
        value = unique.join(', ')
      } else if (spec.type === 'boolean') {
        // The Delivery page sends a boolean; the Settings page round-trips
        // every row through a text field and sends "true"/"false".
        if (raw === true || raw === 'true') value = true
        else if (raw === false || raw === 'false') value = false
        else {
          return NextResponse.json(
            { error: `${spec.label} must be on or off.` },
            { status: 400 }
          )
        }
      } else if (spec.type === 'number') {
        if ((raw === '' || raw === null) && spec.nullable) {
          value = null
        } else {
          const n = Number(raw)
          if (!Number.isFinite(n) || n < 0) {
            return NextResponse.json(
              { error: `${spec.label} must be a number of zero or more.` },
              { status: 400 }
            )
          }
          value = n
        }
      } else {
        value = String(raw ?? '').trim().slice(0, 200)
      }

      updates.push({ key, value })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // Door delivery and store pickup can't both be off (029): checkout would
    // have no way to get an order to anyone. Check against what's saved, since
    // the Delivery page switches one at a time.
    const METHOD_KEYS = ['doorstep_delivery_enabled', 'store_pickup_enabled']
    if (updates.some((u) => METHOD_KEYS.includes(u.key))) {
      const { data: saved } = await auth.supabase
        .from('settings')
        .select('key, value')
        .in('key', METHOD_KEYS)
      const after = Object.fromEntries(METHOD_KEYS.map((k) => [k, true]))
      for (const row of saved || []) after[row.key] = row.value !== false
      for (const u of updates) if (METHOD_KEYS.includes(u.key)) after[u.key] = u.value
      if (!after.doorstep_delivery_enabled && !after.store_pickup_enabled) {
        return NextResponse.json(
          { error: 'Keep door delivery or store pickup on. With both off, customers can’t check out.' },
          { status: 400 }
        )
      }
    }

    // settings.value is jsonb — Supabase serialises the JS value for us.
    // Upsert, so a setting added after the seed (order_alert_email) creates its
    // row on first save. A new row takes the column defaults: is_public = false,
    // which keeps it out of the storefront. Existing rows keep their is_public
    // and description — only value is written.
    for (const u of updates) {
      const { error } = await auth.supabase
        .from('settings')
        .upsert({ key: u.key, value: u.value }, { onConflict: 'key' })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    // Drop the pricing cache so checkout picks the change up immediately
    // rather than after the 60s TTL.
    invalidateSettingsCache()

    const { data } = await auth.supabase
      .from('settings')
      .select('key, value, description, is_public, updated_at')
      .order('key', { ascending: true })

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

export { EDITABLE }
