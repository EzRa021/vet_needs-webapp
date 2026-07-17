import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { ok, fail, parseBody } from '@/lib/api'
import { allow, TOO_MANY } from '@/lib/rate-limit'

const NewsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  source: z.enum(['footer', 'checkout', 'popup']).catch('footer'),
  website: z.string().optional(), // honeypot
})

// POST /api/newsletter
//
// Deliberately always reports success for a valid address, even if it was
// already subscribed — telling a stranger "that email is already on the list"
// would leak who your customers are.
export async function POST(request) {
  try {
    const { data: body, response } = await parseBody(request, NewsletterSchema)
    if (response) return response

    // Honeypot: real people never fill a hidden field. Silently accept so the
    // bot thinks it worked. Before the rate limit, so bots don't eat a real
    // visitor's budget on a shared IP.
    if (body.website) return ok({ ok: true })

    if (!(await allow(request, 'newsletter'))) {
      return fail(TOO_MANY, 429)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // subscribe_email() upserts, so re-subscribing reactivates rather than
    // erroring — and never reveals whether the address was already there.
    const { error } = await supabase.rpc('subscribe_email', {
      p_email: body.email,
      p_source: body.source,
      p_user: user?.id || null,
    })

    if (error) {
      console.error('Subscribe error:', error)
      return fail("Couldn't sign you up just now. Please try again.", 500)
    }

    return ok({ ok: true })
  } catch (error) {
    console.error('Newsletter API error:', error)
    return fail("Couldn't sign you up just now. Please try again.", 500)
  }
}
