import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, CouponUpdateSchema } from '@/lib/validation/admin'
import { buildPayload, friendlyCouponError } from '../route'

// GET /api/admin/coupons/[id] - coupon + who redeemed it
export async function GET(request, { params }) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params

    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    const { data: redemptions } = await supabase
      .from('coupon_redemptions')
      .select('id, order_id, user_id, discount_amount, created_at')
      .eq('coupon_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Attach customer names (no FK between redemptions and profiles).
    const userIds = [...new Set((redemptions || []).map((r) => r.user_id).filter(Boolean))]
    let names = new Map()
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      names = new Map((profiles || []).map((p) => [p.id, p.full_name]))
    }

    const rows = (redemptions || []).map((r) => ({
      ...r,
      customerName: names.get(r.user_id) || null,
    }))

    const totalGiven =
      Math.round(rows.reduce((s, r) => s + Number(r.discount_amount || 0), 0) * 100) / 100

    return NextResponse.json({
      data: { ...coupon, redemptions: rows, totalGiven },
    })
  } catch (error) {
    console.error('Get coupon error:', error)
    return NextResponse.json({ error: 'Failed to load coupon' }, { status: 500 })
  }
}

// PATCH /api/admin/coupons/[id]
export async function PATCH(request, { params }) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params
    const { data: body, response } = await parseAdminBody(
      request,
      CouponUpdateSchema
    )
    if (response) return response
    const payload = buildPayload(body)

    // used_count reflects real redemptions — never editable by hand.
    delete payload.used_count

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: friendlyCouponError(error) }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Update coupon error:', error)
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
  }
}

// DELETE /api/admin/coupons/[id]
// Refuses once redeemed — deleting would orphan the redemption record and
// corrupt the discount history on real orders.
export async function DELETE(request, { params }) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params

    const { count } = await supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', id)

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error: `This coupon has been used ${count} time${count === 1 ? '' : 's'}, so it can't be deleted. Disable it instead — it stops working immediately and the history stays intact.`,
        },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('coupons').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: friendlyCouponError(error) }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete coupon error:', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}
