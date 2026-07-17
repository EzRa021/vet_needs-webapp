import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/stores/authStore'

// The address book. RLS makes every row private to its owner
// (`auth.uid() = user_id`), so the client can talk to the table directly.
//
// The "exactly one default" rule is NOT enforced here — migration 008 does it
// with a partial unique index plus a trigger that demotes the previous default.
// Doing it in the client would mean two writes that can half-fail, and any
// other caller could break the invariant.

const FIELDS =
  'id, label, first_name, last_name, phone, address, address2, city, state, zip, country, is_default, created_at'

export const useAddresses = () => {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['addresses'],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('addresses')
        .select(FIELDS)
        // Default first: it's the one the customer means most of the time.
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 60 * 1000,
  })
}

export const useDefaultAddress = () => {
  const { data: addresses } = useAddresses()
  return addresses?.find((a) => a.is_default) || null
}

export const useSaveAddress = () => {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async ({ id, ...values }) => {
      if (!user) throw new Error('NOT_SIGNED_IN')
      const supabase = createClient()

      if (id) {
        const { data, error } = await supabase
          .from('addresses')
          .update(values)
          .eq('id', id)
          .select(FIELDS)
          .single()
        if (error) throw error
        return data
      }

      const { data, error } = await supabase
        .from('addresses')
        .insert({ ...values, user_id: user.id })
        .select(FIELDS)
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export const useDeleteAddress = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      const { error } = await supabase.from('addresses').delete().eq('id', id)
      if (error) throw error
    },
    // A delete can promote a new default (008's after-delete trigger), so the
    // whole list is refetched rather than patched locally.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export const useSetDefaultAddress = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const supabase = createClient()
      // Only this row is written; the trigger demotes the previous default.
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

// Maps a saved address onto the checkout form's shippingInfo shape. Email is
// not stored per-address (it's account-level), so the caller supplies it.
export function addressToShippingInfo(address, email = '') {
  if (!address) return null
  return {
    firstName: address.first_name || '',
    lastName: address.last_name || '',
    email,
    phone: address.phone || '',
    address: address.address || '',
    address2: address.address2 || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || '',
    country: address.country || 'NG',
  }
}
