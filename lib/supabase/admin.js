import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. SERVER ONLY (webhooks, admin tasks).
// Never import this in client components.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
