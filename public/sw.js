// VetNeeds service worker.
//
// DELIBERATELY MINIMAL. Its only jobs are (1) make the app installable — a PWA
// needs a service worker with a fetch handler — and (2) show a branded page
// instead of the browser's dinosaur when the device is offline.
//
// ⚠️ IT CACHES NO DYNAMIC CONTENT, ON PURPOSE. A shop that serves a product
// page or an API response from cache serves a STALE PRICE — the same class of
// bug as the localStorage cart that showed last week's total. Prices, stock and
// orders must always come from the network. So this SW is network-first for
// navigations and simply passes everything else straight through; the only
// thing it ever serves from cache is the static offline page.

const CACHE = 'vetneeds-shell-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icon-app.svg']))
      // Take over on first load rather than waiting for every tab to close.
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never interfere with non-GET (form posts, checkout, mutations) or with
  // anything that isn't a page navigation. API calls, images and scripts go
  // straight to the network — no cache, no staleness.
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  // Network-first: the live page always wins. Only if the network is genuinely
  // unreachable do we show the offline fallback.
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
})
