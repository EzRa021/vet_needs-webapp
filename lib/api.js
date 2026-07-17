import { NextResponse } from 'next/server'

// One shape for every API response, so the client never has to guess.
//   success → { data, ...extras }
//   failure → { error: "<sentence a human can read>" }
//
// `error` is a STRING, not a code or an object, because every caller in this
// app already does `json.error || 'Something went wrong'` and shows it to a
// customer. Changing that shape now would silently degrade a dozen toasts to
// their fallback text.

export const ok = (data, extras = {}) => NextResponse.json({ data, ...extras })

export const fail = (message, status = 400) =>
  NextResponse.json({ error: message }, { status })

// The caller's IP, for rate limiting.
//
// x-forwarded-for is a CHAIN ("client, proxy1, proxy2") and is client-supplied
// at the first hop — anyone can send one. The LEFTMOST value is the closest
// thing to the real client, and it's what a well-behaved proxy puts there.
// This is a rate limiter, not authentication: a spoofed IP costs the spoofer
// their own budget, and the real defence for anything that matters is auth.
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    ''
  )
}

// Turns a ZodError into the one-line message this app's UI expects.
// Zod's `issues` are precise and unreadable; the first one, prefixed with the
// field, is what a person can act on.
export function zodMessage(error) {
  const issue = error?.issues?.[0]
  if (!issue) return 'Invalid request'
  const field = issue.path?.join('.')
  return field ? `${field}: ${issue.message}` : issue.message
}

// Parse + validate a request body in one step.
// Returns { data } or { response } — the caller returns `response` as-is.
export async function parseBody(request, schema) {
  let body
  try {
    body = await request.json()
  } catch {
    return { response: fail('Invalid JSON body') }
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return { response: fail(zodMessage(result.error)) }
  }
  return { data: result.data }
}
