import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/taxonomy - the whole active category tree, nested.
// One cached call powers the header mega-menu, mobile drawer and filters.
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url, parent_id, depth, path, sort_order')
      .eq('is_active', true)
      .order('depth', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Taxonomy fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build a nested tree from the flat list
    const byId = new Map()
    const roots = []
    for (const node of data || []) {
      byId.set(node.id, { ...node, children: [] })
    }
    for (const node of byId.values()) {
      if (node.parent_id && byId.has(node.parent_id)) {
        byId.get(node.parent_id).children.push(node)
      } else {
        roots.push(node)
      }
    }

    return NextResponse.json({ data: roots })
  } catch (error) {
    console.error('Taxonomy API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
