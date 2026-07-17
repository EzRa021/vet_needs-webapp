import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp } from '@/lib/api'

// Budgets per endpoint. Tuned to what a real person does, not to what feels
// strict — a limit a genuine customer can hit is a bug, not security.
export const LIMITS = {
  // Someone with a question, retrying after a typo, sends 2–3. Twenty an hour
  // from one IP is a script.
  contact: { max: 5, windowSeconds: 3600 },
  // Subscribing twice is a mis-click. Ten in an hour is enumeration.
  newsletter: { max: 5, windowSeconds: 3600 },
  // Coupon codes are guessable by design ("SAVE10"), so this one is the actual
  // brute-force surface: a tight window stops someone walking the keyspace.
  coupon: { max: 20, windowSeconds: 300 },
  // Order creation is already idempotency-keyed and priced server-side; this
  // is about junk rows, not fraud.
  order: { max: 20, windowSeconds: 600 },
  // A refund request per order is capped by a unique index; this stops someone
  // hammering the RPC.
  refund: { max: 10, windowSeconds: 3600 },
}

// Returns true when the request may proceed.
//
// FAILS OPEN. If the limiter itself is broken or 019 hasn't run, the shop keeps
// working — a contact form that refuses everyone because a counter table is
// missing is a worse outage than the spam it was meant to stop. That's the
// right trade here precisely because none of these endpoints are the security
// boundary: prices, ownership and payment are all enforced elsewhere.
export async function allow(request, bucket, extraKey = '') {
  const limit = LIMITS[bucket]
  if (!limit) return true

  const ip = clientIp(request)
  if (!ip) return true

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: `${bucket}:${ip}${extraKey ? `:${extraKey}` : ''}`,
      p_max: limit.max,
      p_window_seconds: limit.windowSeconds,
    })
    if (error) {
      console.error(`Rate limit check failed for ${bucket}:`, error.message)
      return true
    }
    return data !== false
  } catch (e) {
    console.error(`Rate limit threw for ${bucket}:`, e.message)
    return true
  }
}

export const TOO_MANY =
  "That's a few too many attempts. Please wait a little and try again."
