import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, CouponCreateSchema } from '@/lib/validation/admin'

// Coupons are admin-only (RLS: "admins manage coupons"). Staff must not be able
// to mint discounts.
function buildPayload(body) {
  const out = {}

  if (typeof body.code === 'string') {
    // Codes are always stored uppercase with no spaces so lookup is exact.
    out.code = body.code.trim().toUpperCase().replace(/\s+/g, '').slice(0, 40)
  }
  if (typeof body.description === 'string') {
    out.description = body.description.trim().slice(0, 300) || null
  }
  if (body.discount_type === 'percent' || body.discount_type === 'fixed') {
    out.discount_type = body.discount_type
  }

  const num = (key, { min = 0, max = 1e12, nullable = false } = {}) => {
    if (!(key in body)) return
    const raw = body[key]
    if (raw === '' || raw === null || raw === undefined) {
      if (nullable) out[key] = null
      return
    }
    const n = Number(raw)
    if (Number.isFinite(n)) out[key] = Math.min(Math.max(n, min), max)
  }

  num('discount_value')
  num('min_order_amount')
  num('max_discount_amount', { nullable: true })
  num('max_uses', { nullable: true })
  num('max_uses_per_user', { min: 1 })

  const date = (key, { nullable = false } = {}) => {
    if (!(key in body)) return
    const raw = body[key]
    if (!raw) {
      if (nullable) out[key] = null
      return
    }
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) out[key] = d.toISOString()
  }
  date('starts_at')
  date('expires_at', { nullable: true })

  if (typeof body.is_active === 'boolean') out.is_active = body.is_active
  if (typeof body.first_order_only === 'boolean') {
    out.first_order_only = body.first_order_only
  }

  // Scope (020). A uuid whitelist rather than trusting the array: these go
  // straight into an `= any(...)` against the catalogue.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const idArray = (key) => {
    if (!(key in body)) return
    const arr = Array.isArray(body[key]) ? body[key] : []
    out[key] = arr.filter((v) => typeof v === 'string' && UUID.test(v)).slice(0, 50)
  }
  idArray('applies_to_category_ids')
  idArray('applies_to_item_ids')

  return out
}

// GET /api/admin/coupons
export async function GET(request) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim().slice(0, 60)

    let query = supabase.from('coupons').select('*').order('created_at', { ascending: false })

    if (search) {
      const safe = search.replace(/[,()\\%_]/g, ' ').trim()
      if (safe) query = query.or(`code.ilike.*${safe}*,description.ilike.*${safe}*`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Admin coupons error:', error)
    return NextResponse.json({ error: 'Failed to load coupons' }, { status: 500 })
  }
}

// POST /api/admin/coupons
export async function POST(request) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { data: body, response } = await parseAdminBody(
      request,
      CouponCreateSchema
    )
    if (response) return response
    const payload = buildPayload(body)

    // used_count is owned by redemption — never accepted from the client.
    delete payload.used_count

    const { data, error } = await supabase.from('coupons').insert([payload]).select().single()
    if (error) {
      return NextResponse.json({ error: friendlyCouponError(error) }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}

export { buildPayload }

export function friendlyCouponError(error) {
  const msg = error?.message || ''
  if (msg.includes('coupons_code_key') || msg.includes('duplicate key')) {
    return 'That code already exists. Pick a different one.'
  }
  if (msg.includes('discount_value')) return 'The discount must be greater than zero.'
  return msg || 'Database rejected the change.'
}
