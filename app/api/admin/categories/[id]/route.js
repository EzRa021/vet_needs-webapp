import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { friendlyDbError } from '../route'

// PATCH /api/admin/categories/[id] - rename, move, reorder, activate/deactivate
export async function PATCH(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params
    const body = await request.json()

    const patch = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.description === 'string') patch.description = body.description.trim() || null
    if (typeof body.image_url === 'string') patch.image_url = body.image_url.trim() || null
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
    if (Number.isFinite(Number(body.sort_order))) patch.sort_order = Number(body.sort_order)
    // Truncated to what search engines actually render — a 300-char meta
    // description is just a truncated one with extra bytes.
    if (typeof body.meta_title === 'string') {
      patch.meta_title = body.meta_title.trim().slice(0, 70) || null
    }
    if (typeof body.meta_description === 'string') {
      patch.meta_description = body.meta_description.trim().slice(0, 160) || null
    }
    // parent_id: null means "promote to department"
    if ('parent_id' in body) {
      if (body.parent_id === id) {
        return NextResponse.json({ error: "A category can't be its own parent." }, { status: 400 })
      }
      patch.parent_id = body.parent_id || null
    }
    // Renaming should refresh the slug so the path stays readable
    if (patch.name && body.regenerate_slug !== false) patch.slug = null

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: friendlyDbError(error) }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE /api/admin/categories/[id]
// Refuses when the node still has children or products — the admin must
// move them first, so products are never silently orphaned.
export async function DELETE(request, { params }) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { id } = await params

    const [{ count: childCount }, { count: itemCount }] = await Promise.all([
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', id),
      supabase.from('items').select('id', { count: 'exact', head: true }).eq('category_id', id),
    ])

    if (childCount > 0) {
      return NextResponse.json(
        { error: `This category has ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}. Move or delete them first.` },
        { status: 409 }
      )
    }
    if (itemCount > 0) {
      return NextResponse.json(
        { error: `${itemCount} product${itemCount === 1 ? '' : 's'} still use this category. Move them first, or deactivate the category instead.` },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: friendlyDbError(error) }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
