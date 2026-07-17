import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/stores/authStore'

// The wishlist lives in Postgres, not localStorage: RLS makes each row private
// to its owner (`auth.uid() = user_id`), and a saved item should still be there
// on the customer's phone after they saved it on a laptop.

// Just the ids, as a Set. Every ProductCard needs to know "is this saved?", and
// a grid renders dozens of them — one cached query answers all of them, where a
// per-card query would fire N requests per page.
export const useWishlistIds = () => {
  const { data: user } = useUser()

  const query = useQuery({
    queryKey: ['wishlist', 'ids'],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('wishlists').select('item_id')
      if (error) throw error
      return (data || []).map((r) => r.item_id)
    },
    staleTime: 60 * 1000,
  })

  return {
    ...query,
    // A logged-out visitor has an empty wishlist rather than an error state.
    ids: new Set(query.data || []),
  }
}

// The full list with product data, for /account/wishlist.
export const useWishlist = () => {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['wishlist', 'items'],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      // Explicit FK on the items→categories embed: item_categories creates a
      // second path, which makes a bare embed ambiguous (PGRST201).
      const { data, error } = await supabase
        .from('wishlists')
        .select(
          `id, created_at, item_id,
           item:items (
             id, name, price, compare_at_price, image_url, stock, unit_type,
             is_active, allow_backorder, low_stock_threshold, rating_avg, rating_count,
             vat_enabled, vat_rate, vat_inclusive,
             category:categories!items_category_id_fkey (id, name)
           )`
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 60 * 1000,
  })
}

// Add/remove. Optimistic, because a heart that waits for a round-trip before
// filling feels broken.
export const useToggleWishlist = () => {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async ({ itemId, saved }) => {
      if (!user) throw new Error('NOT_SIGNED_IN')
      const supabase = createClient()

      if (saved) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', user.id)
        if (error) throw error
        return { itemId, saved: false }
      }

      const { error } = await supabase
        .from('wishlists')
        .insert({ item_id: itemId, user_id: user.id })
      // 23505 = the unique (user_id, item_id) index: it's already saved, which
      // is the state the customer wanted anyway. Not an error worth surfacing.
      if (error && error.code !== '23505') throw error
      return { itemId, saved: true }
    },

    onMutate: async ({ itemId, saved }) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist', 'ids'] })
      const previous = queryClient.getQueryData(['wishlist', 'ids'])

      queryClient.setQueryData(['wishlist', 'ids'], (old = []) =>
        saved ? old.filter((id) => id !== itemId) : [...old, itemId]
      )

      return { previous }
    },

    onError: (_err, _vars, context) => {
      // Put the heart back where it was — never leave the UI claiming something
      // is saved when the write failed.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['wishlist', 'ids'], context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
    },
  })
}
