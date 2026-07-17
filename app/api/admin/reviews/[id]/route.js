import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'

// PATCH /api/admin/reviews/[id] — hide or restore a review.
//
// is_approved is the ONLY field this accepts. Staff moderate; they don't
// rewrite a customer's words. Letting staff edit the text would put words in
// the customer's mouth under their own name.
export async function PATCH(request, { params }) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabase } = auth
    const { id } = await params

    const body = await request.json()
    if (typeof body.is_approved !== 'boolean') {
      return NextResponse.json(
        { error: 'is_approved (boolean) is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({ is_approved: body.is_approved })
      .eq('id', id)
      .select('id, is_approved')
      .single()

    if (error) {
      console.error('Moderate review error:', error)
      return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // items.rating_avg/rating_count only count approved reviews, and the
    // refresh_item_rating() trigger recalculates them on this update.
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Moderate review API error:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}

// DELETE /api/admin/reviews/[id] — for spam that shouldn't just be hidden.
export async function DELETE(_request, { params }) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabase } = auth
    const { id } = await params

    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) {
      console.error('Delete review error:', error)
      return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete review API error:', error)
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 })
  }
}
