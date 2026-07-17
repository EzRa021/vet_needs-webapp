import { createClient } from '@/lib/supabase/server'

// Server-side guard for admin APIs and pages.
// Returns { user, profile } when allowed, or { error, status } when not.
// RLS is the real enforcement layer — this gives clean 401/403 responses
// and lets pages redirect instead of rendering an empty screen.
export async function getStaffUser({ requireAdmin = false } = {}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Profile not found', status: 403 }
  }

  const allowed = requireAdmin
    ? profile.role === 'admin'
    : profile.role === 'admin' || profile.role === 'staff'

  if (!allowed) {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile, supabase }
}

export const ROLES = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin',
}
