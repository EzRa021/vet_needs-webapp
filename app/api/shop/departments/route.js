import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/shop/departments - top-level nodes of the category tree
// (a "department" is simply a category with no parent).
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url, sort_order')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Departments fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Departments API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
