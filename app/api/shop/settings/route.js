import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'

// GET /api/shop/settings - public store settings for display.
//
// The `settings` table has RLS allowing reads only where is_public = true, and
// we additionally whitelist here: never return a key just because someone
// flipped is_public by mistake.
const PUBLIC_KEYS = [
  'store_name',
  'currency',
  'shipping_flat_fee',
  'vat_rate',
  'support_email',
  'support_phone',
  'free_shipping_threshold',
]

export async function GET() {
  try {
    const settings = await getSettings()
    const data = Object.fromEntries(
      PUBLIC_KEYS.map((k) => [k, settings[k]])
    )
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Public settings error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}
