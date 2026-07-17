import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'

// GET /api/admin/reviews — moderation queue.
// Uses the STAFF's own session (not the service role), so the "staff moderate
// reviews" RLS policy is still the thing granting access. getStaffUser() only
// turns a denial into a clean 403 instead of an empty list.
export async function GET(request) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabase } = auth
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') || 'all'
    const search = (searchParams.get('search') || '').slice(0, 100)
    const rating = parseInt(searchParams.get('rating'))
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 20, 1), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('reviews')
      .select(
        `id, rating, title, comment, is_approved, is_verified_purchase,
         author_name, created_at, updated_at, item_id, user_id,
         item:items (id, name, image_url)`,
        { count: 'exact' }
      )

    if (status === 'approved') query = query.eq('is_approved', true)
    if (status === 'hidden') query = query.eq('is_approved', false)
    if (Number.isFinite(rating)) query = query.eq('rating', rating)

    if (search) {
      // Same defensive escaping as the storefront search: no raw interpolation
      // of user input into a PostgREST .or() filter.
      const safe = search.replace(/[,()\\%_]/g, ' ').trim()
      if (safe) {
        query = query.or(
          `title.ilike.*${safe}*,comment.ilike.*${safe}*,author_name.ilike.*${safe}*`
        )
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Admin reviews fetch error:', error)
      return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        pages: Math.ceil((count || 0) / limit),
        limit,
      },
    })
  } catch (error) {
    console.error('Admin reviews API error:', error)
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}
