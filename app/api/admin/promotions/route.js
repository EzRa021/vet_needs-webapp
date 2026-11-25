import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, PromotionCreateSchema } from '@/lib/validation/admin'

export const PLACEMENTS = ['home_hero', 'home_tile', 'home_banner', 'shop_banner', 'popup']

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
  if (typeof body.image_only === 'boolean') out.image_only = body.image_only
  if (['visit', 'day', 'week'].includes(body.popup_repeat)) out.popup_repeat = body.popup_repeat
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

// Database refusals that mean a migration hasn't been run yet, in words staff
// can act on, instead of "Could not find the 'image_only' column…".
export function promotionSaveError(error) {
  const msg = String(error?.message || '')
  if (/popup_repeat/.test(msg)) {
    return 'Choosing how often the popup shows needs migration 035. Run it in the Supabase SQL editor, then save again.'
  }
  if (error?.code === 'PGRST204' || /image_only/.test(msg)) {
    return 'The "Picture only" option needs migration 034. Run it in the Supabase SQL editor, then save again.'
  }
  if (error?.code === '23514' && /placement/.test(msg)) {
    return 'The "Home tile" placement needs migration 033. Run it in the Supabase SQL editor, then save again.'
  }
  return msg || 'Could not save the promotion.'
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
    const { data: body, response } = await parseAdminBody(
      request,
      PromotionCreateSchema
    )
    if (response) return response
    const payload = buildPayload(body)
    if (!payload.placement) payload.placement = 'home_hero'

    const { data, error } = await auth.supabase
      .from('promotions')
      .insert([payload])
      .select()
      .single()
    if (error) return NextResponse.json({ error: promotionSaveError(error) }, { status: 400 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create promotion error:', error)
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 })
  }
}

export { buildPayload }
