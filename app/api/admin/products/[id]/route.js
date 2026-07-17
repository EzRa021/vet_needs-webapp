import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { buildPayload, friendlyItemError } from '../route'

// GET /api/admin/products/[id] - product + its audit trail
export async function GET(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params

    const [item, history] = await Promise.all([
      supabase
        .from('items')
        // Explicit FK — item_categories makes a bare embed ambiguous (PGRST201)
        .select('*, category:categories!items_category_id_fkey(id, name, path)')
        .eq('id', id)
        .single(),
      supabase
        .from('item_history')
        .select('id, type, created_by, details, created_at')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (item.error) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: { ...item.data, history: history.data || [] },
    })
  } catch (error) {
    console.error('Get product error:', error)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
}

// PATCH /api/admin/products/[id]
// Stock/price/VAT changes are recorded automatically by the item_history
// trigger (see 000_initial_schema.sql) — no manual audit writes needed.
export async function PATCH(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params
    const body = await request.json()
    const payload = buildPayload(body)

    if ('name' in payload && !payload.name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('items')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: friendlyItemError(error) }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Update product error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE /api/admin/products/[id]
// Refuses if the product appears in any order — deleting would corrupt order
// history. Deactivating is the correct action for retired products.
export async function DELETE(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_items')
      .limit(500)

    if (!ordersError && orders) {
      const used = orders.some((o) => {
        const items = Array.isArray(o.order_items) ? o.order_items : []
        return items.some((i) => String(i.id) === String(id))
      })
      if (used) {
        return NextResponse.json(
          {
            error:
              'This product appears in past orders, so it can’t be deleted. Switch it to inactive instead — it will disappear from the store but order history stays intact.',
          },
          { status: 409 }
        )
      }
    }

    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: friendlyItemError(error) }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
