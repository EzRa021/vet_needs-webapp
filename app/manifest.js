// Web app manifest (Next App Router metadata route → /manifest.webmanifest).
// Makes the shop installable — "Add to Home Screen" — which is the whole ask:
// repeat farm buyers reorder feed, and an icon on the phone beats retyping a URL.
export default function manifest() {
  return {
    name: 'VetNeeds — Poultry Feed, Pet Food & Farm Supplies',
    short_name: 'VetNeeds',
    description:
      'Quality poultry feed, pet food and farm & pet accessories, delivered across Nigeria.',
    start_url: '/',
    // standalone = opens without browser chrome, like a native app.
    display: 'standalone',
    // Cream page bg / deep forest green — the same tokens as the site, so the
    // splash and status bar match the shop rather than flashing white.
    background_color: '#FAFBF8',
    theme_color: '#1F6B45',
    orientation: 'portrait',
    categories: ['shopping', 'business'],
    icons: [
      {
        // A single SVG covers every size, and modern Chromium (Chrome on
        // Android — the dominant case here) installs from it. `maskable` lets
        // the launcher crop it to the device's icon shape without clipping the
        // mark, because the green is full-bleed.
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
