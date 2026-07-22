import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, CustomerRoleSchema } from '@/lib/validation/admin'
import { createAdminClient } from '@/lib/supabase/admin'

// ROLES now lives in lib/validation/admin.js, where CustomerRoleSchema enforces it.
const PAID = ['paid', 'processing', 'shipped', 'delivered']

// GET /api/admin/customers/[id] - profile + order history
export async function GET(request, { params }) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase, user } = auth

  try {
    const { id } = await params

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, status, total_amount, order_items, shipping_address')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Email + confirmation state come from auth.users (service role only).
    let email = null
    let emailConfirmed = null
    let lastSignIn = null
    try {
      const admin = createAdminClient()
      const { data: authUser } = await admin.auth.admin.getUserById(id)
      email = authUser?.user?.email || null
      emailConfirmed = Boolean(authUser?.user?.email_confirmed_at)
      lastSignIn = authUser?.user?.last_sign_in_at || null
    } catch (e) {
      console.warn('Could not read auth user:', e.message)
    }

    const paidOrders = (orders || []).filter((o) => PAID.includes(o.status))
    const lifetimeSpend =
      Math.round(paidOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0) * 100) / 100

    return NextResponse.json({
      data: {
        ...profile,
        email,
        emailConfirmed,
        lastSignIn,
        orders: orders || [],
        stats: {
          orderCount: (orders || []).length,
          paidCount: paidOrders.length,
          lifetimeSpend,
          avgOrderValue:
            paidOrders.length > 0
              ? Math.round((lifetimeSpend / paidOrders.length) * 100) / 100
              : 0,
        },
        isSelf: id === user.id,
      },
    })
  } catch (error) {
    console.error('Get customer error:', error)
    return NextResponse.json({ error: 'Failed to load customer' }, { status: 500 })
  }
}

// PATCH /api/admin/customers/[id] - change a user's role.
// Whitelist is role only — an admin must never be able to edit someone else's
// personal details from here.
export async function PATCH(request, { params }) {
  const auth = await getStaffUser({ requireAdmin: true })
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase, user } = auth

  try {
    const { id } = await params
    const { data: body, response } = await parseAdminBody(
      request,
      CustomerRoleSchema
    )
    if (response) return response
    const role = body.role

    const { data: target, error: readError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', id)
      .single()

    if (readError || !target) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    if (target.role === role) {
      return NextResponse.json({ error: 'That is already their role.' }, { status: 400 })
    }

    // Guard 1: never let an admin demote themselves — they'd lose access to
    // this page mid-action and might not be able to undo it.
    if (id === user.id && role !== 'admin') {
      return NextResponse.json(
        {
          error:
            "You can't change your own role. Ask another admin to do it, so you're never locked out by accident.",
        },
        { status: 400 }
      )
    }

    // Guard 2: never remove the last admin — that would leave the store
    // permanently unmanageable.
    if (target.role === 'admin' && role !== 'admin') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')

      if ((count || 0) <= 1) {
        return NextResponse.json(
          {
            error:
              'This is the only admin. Promote someone else to admin first, otherwise nobody could manage the store.',
          },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select('id, full_name, role')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Update customer role error:', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}
