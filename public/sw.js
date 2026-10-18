const VERSION = 'ghost60-v2'
const OFFLINE = '/offline.html'
const STATIC = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', OFFLINE]

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(STATIC)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('ghost60-') && key !== VERSION).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) ?? new Response('You are offline. Reconnect to open Ghost60.', { status: 503, headers: { 'Content-Type': 'text/plain' } })))
    return
  }
  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/icons/') && !STATIC.includes(url.pathname)) return
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then(async (res) => {
    if (res.ok && res.type !== 'opaque') {
      const cache = await caches.open(VERSION)
      await cache.put(req, res.clone())
    }
    return res
  })))
})
