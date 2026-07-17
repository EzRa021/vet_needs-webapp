import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/categories - children of a node in the category tree.
//   ?parent=<id>      → direct children of that node
//   ?department=<id>  → back-compat alias for ?parent
//   (no param)        → all categories that have a parent (leaf/child nodes)
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parent') || searchParams.get('department')

    let query = supabase
      .from('categories')
      .select('id, name, slug, description, image_url, parent_id, depth, path, sort_order')
      .eq('is_active', true)

    if (parentId && parentId !== 'all') {
      query = query.eq('parent_id', parentId)
    } else {
      // default: children only (exclude root departments)
      query = query.not('parent_id', 'is', null)
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Categories fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
