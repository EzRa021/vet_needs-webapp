import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/stores/authStore'

// Reviews are read straight from Postgres: RLS already says "approved reviews
// are public, and you can always see your own" (`is_approved or auth.uid() =
// user_id`), which is exactly the storefront rule. No API route needed.
//
// Everything that must not be client-controlled — is_approved,
// is_verified_purchase, author_name — is stamped by the reviews_guard()
// trigger in migration 007, not sent from here.

const REVIEW_FIELDS =
  'id, item_id, user_id, rating, title, comment, is_approved, is_verified_purchase, author_name, created_at, updated_at'

export const useItemReviews = (itemId) =>
  useQuery({
    queryKey: ['reviews', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('reviews')
        .select(REVIEW_FIELDS)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 60 * 1000,
  })

// The signed-in user's own review for this item, if any. Drives "write" vs
// "edit" — the table has a unique (item_id, user_id), so a second insert would
// fail with 23505 rather than create a second review.
export const useMyReview = (itemId) => {
  const { data: user } = useUser()
  const { data: reviews } = useItemReviews(itemId)

  return user ? reviews?.find((r) => r.user_id === user.id) || null : null
}

// Star histogram. Derived from the rows we already fetched rather than a second
// round-trip.
export function ratingSummary(reviews = []) {
  const approved = reviews.filter((r) => r.is_approved)
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of approved) counts[r.rating] = (counts[r.rating] || 0) + 1

  const total = approved.length
  const average = total
    ? approved.reduce((sum, r) => sum + r.rating, 0) / total
    : 0

  return {
    total,
    average,
    counts,
    // Percentage per star, for the bars.
    percent: Object.fromEntries(
      [5, 4, 3, 2, 1].map((star) => [star, total ? (counts[star] / total) * 100 : 0])
    ),
  }
}

// Real reviews for the home page's social-proof section, which previously used
// three hardcoded fake customers. Only approved 4–5 star reviews that actually
// say something — a bare rating with no words is not a testimonial.
export const useTopReviews = (limit = 3) =>
  useQuery({
    queryKey: ['reviews', 'top', limit],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('reviews')
        .select(
          `id, rating, title, comment, author_name, created_at, item_id,
           item:items (id, name)`
        )
        .eq('is_approved', true)
        .gte('rating', 4)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

export const useSaveReview = (itemId) => {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async ({ id, rating, title, comment }) => {
      if (!user) throw new Error('NOT_SIGNED_IN')
      const supabase = createClient()

      const payload = {
        rating,
        title: title?.trim() || null,
        comment: comment?.trim() || null,
      }

      if (id) {
        const { data, error } = await supabase
          .from('reviews')
          .update(payload)
          .eq('id', id)
          .select(REVIEW_FIELDS)
          .single()
        if (error) throw error
        return data
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...payload, item_id: itemId, user_id: user.id })
        .select(REVIEW_FIELDS)
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', itemId] })
      // items.rating_avg/rating_count are updated by the refresh_item_rating()
      // trigger, so the cached product + grids are now stale.
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export const useDeleteReview = (itemId) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', itemId] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}
