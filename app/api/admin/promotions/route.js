import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'

export const PLACEMENTS = ['home_hero', 'home_banner', 'shop_banner', 'popup']

function buildPayload(body) {
  const out = {}
  const str = (k, max) => {
    if (typeof body[k] === 'string') out[k] = body[k].trim().slice(0, max) || null
  }
  str('title', 200)
  str('subtitle', 300)
  str('image_url', 1000)
  str('link_url', 500)

  if (PLACEMENTS.includes(body.placement)) out.placement = body.placement
  if (typeof body.is_active === 'boolean') out.is_active = body.is_active
  if (Number.isFinite(Number(body.sort_order))) out.sort_order = Number(body.sort_order)

  const date = (k, nullable) => {
    if (!(k in body)) return
    if (!body[k]) {
      if (nullable) out[k] = null
      return
    }
    const d = new Date(body[k])
    if (!Number.isNaN(d.getTime())) out[k] = d.toISOString()
  }
  date('starts_at', false)
  date('ends_at', true)

  return out
}

// GET /api/admin/promotions
export async function GET() {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { data, error } = await auth.supabase
      .from('promotions')
      .select('*')
      .order('placement', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Admin promotions error:', error)
    return NextResponse.json({ error: 'Failed to load promotions' }, { status: 500 })
  }
}

// POST /api/admin/promotions
export async function POST(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const body = await request.json()
    const payload = buildPayload(body)

    if (!payload.title) {
      return NextResponse.json({ error: 'Give the promotion a title.' }, { status: 400 })
    }
    if (!payload.placement) payload.placement = 'home_hero'
    if (payload.starts_at && payload.ends_at && new Date(payload.ends_at) <= new Date(payload.starts_at)) {
      return NextResponse.json({ error: 'The end date must be after the start date.' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('promotions')
      .insert([payload])
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create promotion error:', error)
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 })
  }
}

export { buildPayload }
