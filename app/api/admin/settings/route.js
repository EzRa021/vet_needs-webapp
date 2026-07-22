import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, SettingsUpdateSchema } from '@/lib/validation/admin'
import { invalidateSettingsCache } from '@/lib/settings'

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
}

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
      if (spec.type === 'number') {
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

    // settings.value is jsonb — Supabase serialises the JS value for us.
    for (const u of updates) {
      const { error } = await auth.supabase
        .from('settings')
        .update({ value: u.value })
        .eq('key', u.key)
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
