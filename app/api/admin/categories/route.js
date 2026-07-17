import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'

// GET /api/admin/categories - full tree (including inactive nodes) + product counts
export async function GET() {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url, parent_id, depth, path, sort_order, is_active, pos_external_id')
      .order('path', { ascending: true })

    if (error) throw error

    // Count products per category (primary category_id only)
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('category_id')
    if (itemsError) throw itemsError

    const counts = new Map()
    for (const it of items || []) {
      if (it.category_id) counts.set(it.category_id, (counts.get(it.category_id) || 0) + 1)
    }

    // Build nested tree
    const byId = new Map()
    const roots = []
    for (const n of data || []) {
      byId.set(n.id, { ...n, productCount: counts.get(n.id) || 0, children: [] })
    }
    for (const n of byId.values()) {
      if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id).children.push(n)
      else roots.push(n)
    }

    return NextResponse.json({ data: roots })
  } catch (error) {
    console.error('Admin categories error:', error)
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}

// POST /api/admin/categories - create a node (department = no parent_id)
export async function POST(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const body = await request.json()
    const name = (body.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const payload = {
      name,
      parent_id: body.parent_id || null,
      description: body.description?.trim() || null,
      image_url: body.image_url?.trim() || null,
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      is_active: body.is_active !== false,
      // meta_* have existed since 000 and generateMetadata already reads them
      // (see the SEO pass) — the payload just never carried them, so the
      // columns could only ever be null.
      meta_title: body.meta_title?.trim().slice(0, 70) || null,
      meta_description: body.meta_description?.trim().slice(0, 160) || null,
    }
    // slug/path/depth are set by the DB trigger

    const { data, error } = await supabase
      .from('categories')
      .insert([payload])
      .select()
      .single()

    if (error) {
      // Surface the DB's own guard messages (depth cap, duplicate slug, cycles)
      return NextResponse.json({ error: friendlyDbError(error) }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

export function friendlyDbError(error) {
  const msg = error?.message || ''
  if (msg.includes('nesting too deep')) {
    return 'That would nest the category too deep (max 5 levels).'
  }
  if (msg.includes('own descendants') || msg.includes('own parent')) {
    return "You can't move a category inside itself."
  }
  if (msg.includes('duplicate key') || msg.includes('unique')) {
    return 'A category with that name already exists here. Use a different name.'
  }
  return msg || 'Database rejected the change.'
}
