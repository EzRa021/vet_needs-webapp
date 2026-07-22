import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, PromotionUpdateSchema } from '@/lib/validation/admin'
import { buildPayload } from '../route'

// PATCH /api/admin/promotions/[id]
export async function PATCH(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { id } = await params
    const { data: body, response } = await parseAdminBody(
      request,
      PromotionUpdateSchema
    )
    if (response) return response
    const payload = buildPayload(body)
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('promotions')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Update promotion error:', error)
    return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 })
  }
}

// DELETE /api/admin/promotions/[id]
// Promotions are pure content — safe to delete outright.
export async function DELETE(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const { id } = await params
    const { error } = await auth.supabase.from('promotions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete promotion error:', error)
    return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 })
  }
}
