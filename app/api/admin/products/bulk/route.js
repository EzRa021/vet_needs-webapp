import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, ProductBulkSchema } from '@/lib/validation/admin'

const MAX_IDS = 200

// POST /api/admin/products/bulk
//   { ids: [...], action: 'activate'|'deactivate'|'move'|'price', ... }
//
// Bulk edits are the easiest place in an admin to do enormous damage quickly —
// one bad click repriced across 200 products. So:
//   · every write goes through the caller's session (staff RLS still applies)
//   · price maths happens HERE, never client-side
//   · nothing is applied that the server can't justify per row
//
// items.log_item_changes() (000) fires per row, so a bulk reprice leaves a
// per-product history trail exactly like a manual edit. That's the audit story.
export async function POST(request) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabase } = auth
    const { data: body, response } = await parseAdminBody(
      request,
      ProductBulkSchema
    )
    if (response) return response
    const ids = body.ids

    // ---- activate / deactivate ----
    if (body.action === 'activate' || body.action === 'deactivate') {
      const { data, error } = await supabase
        .from('items')
        .update({ is_active: body.action === 'activate' })
        .in('id', ids)
        .select('id')

      if (error) {
        console.error('Bulk activate error:', error)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }
      return NextResponse.json({ data: { updated: data?.length || 0 } })
    }

    // ---- move to category ----
    if (body.action === 'move') {
      // null is a legitimate destination ("uncategorised"), so only reject
      // undefined — treating null as "missing" would make the option unusable.
      const categoryId = body.category_id === '' ? null : body.category_id
      if (categoryId === undefined) {
        return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
      }

      if (categoryId !== null) {
        // Verify the destination exists rather than trusting an id from a form.
        // A typo'd id would otherwise orphan every selected product.
        const { data: cat } = await supabase
          .from('categories')
          .select('id')
          .eq('id', categoryId)
          .maybeSingle()
        if (!cat) {
          return NextResponse.json({ error: 'That category does not exist' }, { status: 400 })
        }
      }

      const { data, error } = await supabase
        .from('items')
        .update({ category_id: categoryId })
        .in('id', ids)
        .select('id')

      if (error) {
        console.error('Bulk move error:', error)
        return NextResponse.json({ error: 'Move failed' }, { status: 500 })
      }
      return NextResponse.json({ data: { updated: data?.length || 0 } })
    }

    // ---- price ±% ----
    if (body.action === 'price') {
      const percent = Number(body.percent)

      // -100% would make everything free; a fat-fingered 5000 would price feed
      // at ₦1.2m. Neither is a plausible intent, and both are one keystroke away.
      if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500) {
        return NextResponse.json(
          { error: 'Adjustment must be between -90% and +500%, and not zero.' },
          { status: 400 }
        )
      }

      // Read first: the new price is computed from the CURRENT price per row,
      // which PostgREST can't express in a bulk update (no `price * 1.1`).
      const { data: rows, error: readErr } = await supabase
        .from('items')
        .select('id, price')
        .in('id', ids)

      if (readErr) {
        console.error('Bulk price read error:', readErr)
        return NextResponse.json({ error: 'Could not read prices' }, { status: 500 })
      }

      const factor = 1 + percent / 100
      let updated = 0

      for (const row of rows || []) {
        const next = Math.round(Number(row.price) * factor * 100) / 100

        // items_price_positive / the column check would reject this anyway, but
        // failing halfway through a loop leaves a half-repriced catalogue.
        if (!Number.isFinite(next) || next <= 0) continue

        const { error } = await supabase.from('items').update({ price: next }).eq('id', row.id)
        if (error) {
          console.error(`Bulk price failed for ${row.id}:`, error)
          continue
        }
        updated++
      }

      return NextResponse.json({
        data: { updated, skipped: (rows?.length || 0) - updated },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Bulk products API error:', error)
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
  }
}
