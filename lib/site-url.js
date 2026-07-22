// The public origin of this site, for links that leave the app and have to
// come back — Supabase confirmation and password-reset emails, OAuth returns,
// and the Paystack callback.
//
// These were built from window.location.origin, which is whatever host the
// browser happened to be on. Sign up while running the dev server and the
// confirmation email lands on http://localhost:3000 — a link that only works
// on the machine that sent it, and is dead in anyone else's inbox.
//
// NEXT_PUBLIC_APP_URL is the deployed origin and wins wherever it is set. The
// window fallback keeps a local build working if it is ever missing.
//
// Note this is only half the story for Supabase: the target must also be in
// the dashboard's allowed Redirect URLs, or the link is silently rewritten to
// the project's Site URL.
export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** siteUrl() joined to a path: siteUrlTo('/auth/callback'). */
export function siteUrlTo(path) {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
