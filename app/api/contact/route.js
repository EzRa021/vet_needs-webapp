import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { ok, fail, parseBody } from '@/lib/api'
import { allow, TOO_MANY } from '@/lib/rate-limit'

// Must match the options in app/contact/page.tsx and the labels in
// app/admin/messages/page.jsx. Three places, one list — worth a shared const
// the day a fourth appears.
const SUBJECTS = ['general', 'order', 'bulk', 'return', 'product', 'other']

// Validation lives in the schema now rather than a ladder of ifs. The lengths
// aren't decoration: without them this endpoint accepts a 4MB "message".
const ContactSchema = z.object({
  firstName: z.string().trim().min(1, 'Tell us your name.').max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email so we can reply.')
    .max(254),
  phone: z.string().trim().max(40).optional().nullable(),
  subject: z.enum(SUBJECTS).catch('general'),
  message: z
    .string()
    .trim()
    .min(10, 'Please add a bit more detail so we can help.')
    .max(5000),
  // Honeypot. Part of the schema so an unexpected shape can't smuggle it past.
  website: z.string().optional(),
})

// POST /api/contact
export async function POST(request) {
  try {
    const { data: body, response } = await parseBody(request, ContactSchema)
    if (response) return response

    // Honeypot — accept silently so bots don't retry. Checked BEFORE the rate
    // limit so obvious bots don't consume a real person's budget from a shared
    // office IP.
    if (body.website) return ok({ ok: true })

    if (!(await allow(request, 'contact'))) {
      return fail(TOO_MANY, 429)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('contact_messages').insert([
      {
        first_name: body.firstName,
        last_name: body.lastName || null,
        email: body.email,
        phone: body.phone || null,
        subject: body.subject,
        message: body.message,
        user_id: user?.id || null,
      },
    ])

    if (error) {
      console.error('Contact insert error:', error)
      return fail("Couldn't send your message. Please try again.", 500)
    }

    return ok({ ok: true })
  } catch (error) {
    console.error('Contact API error:', error)
    return fail("Couldn't send your message. Please try again.", 500)
  }
}
