/* No API responses, account details, or league results are stored offline. */
const CACHE = 'ssn-offline-__BUILD_ID__';
const ROOT = new URL('./', self.location.href);
const OFFLINE = new URL('offline.html', ROOT).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE, {cache: 'reload'}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ssn-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.open(CACHE)).match(OFFLINE)));
});
