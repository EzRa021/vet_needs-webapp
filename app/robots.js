const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://vetneeds.ng'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',      // staff only
          '/account/',    // someone's orders and addresses
          '/api/',        // not pages
          '/checkout/',   // mid-transaction; indexing it helps nobody
          '/cart',
          '/order/',      // guest order links carry a token — see 011
          '/unsubscribe',
          '/auth/',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  }
}
