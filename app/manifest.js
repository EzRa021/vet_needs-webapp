// Web app manifest (Next App Router metadata route → /manifest.webmanifest).
// Makes the shop installable — "Add to Home Screen" — which is the whole ask:
// pet owners reorder the same food every few weeks, and an icon on the phone
// beats retyping a URL.
export default function manifest() {
  return {
    name: 'Jvigor — Pet Food & Pet Care in Ibadan',
    short_name: 'Jvigor',
    description:
      'Dog and cat food, fresh-frozen meat, pet health products and accessories — delivered to your door in Ibadan or ready to collect.',
    start_url: '/',
    // standalone = opens without browser chrome, like a native app.
    display: 'standalone',
    // Cool page bg / Jvigor blue — the same tokens as the site, so the
    // splash and status bar match the shop rather than flashing white.
    background_color: '#F8FAFC',
    theme_color: '#0077C7',
    orientation: 'portrait',
    categories: ['shopping', 'business'],
    icons: [
      {
        // A single SVG covers every size, and modern Chromium (Chrome on
        // Android — the dominant case here) installs from it. `maskable` lets
        // the launcher crop it to the device's icon shape without clipping the
        // mark, because the blue is full-bleed.
        src: '/icon-app.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon-app.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
