import { createClient } from '@supabase/supabase-js'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://petdo.ng'

// Rebuilt hourly rather than per request: a sitemap that queries the whole
// catalogue on every crawler hit is a free way to hammer the database.
export const revalidate = 3600

// A plain anon client, NOT lib/supabase/server — that one reads cookies, which
// forces the route dynamic ("couldn't be rendered statically because it used
// `cookies`") and quietly drops every product from the sitemap. A sitemap has
// no session; it lists what the public can already see, which is exactly what
// the anon key + RLS returns.
const publicClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

export default async function sitemap() {
  const base = appUrl()
  const now = new Date()

  // Only pages worth indexing. /cart, /checkout, /account and /admin are
  // deliberately absent — they're either private or meaningless to a crawler,
  // and robots.js disallows them anyway.
  const staticRoutes = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ].map((r) => ({ ...r, lastModified: now }))

  try {
    const supabase = publicClient()

    const [items, categories] = await Promise.all([
      supabase
        .from('items')
        .select('id, updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(5000),
      // created_at, not updated_at: `categories` has no updated_at column (it
      // predates the set_updated_at trigger the other tables got). Asking for
      // it fails the whole query, and the catch below would have quietly served
      // 6 static routes while dropping every product and category.
      supabase.from('categories').select('id, created_at').eq('is_active', true),
    ])

    if (items.error) throw items.error
    if (categories.error) throw categories.error

    return [
      ...staticRoutes,
      ...(categories.data || []).map((c) => ({
        url: `${base}/shop/category/${c.id}`,
        lastModified: c.created_at ? new Date(c.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      ...(items.data || []).map((i) => ({
        url: `${base}/product/${i.id}`,
        // Real lastModified from the row, so a crawler can tell what actually
        // changed instead of re-fetching everything because we stamped "now".
        lastModified: i.updated_at ? new Date(i.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })),
    ]
  } catch (error) {
    // A sitemap that 500s is worse than a short one: crawlers back off.
    console.error('Sitemap build failed, serving static routes only:', error.message)
    return staticRoutes
  }
}
