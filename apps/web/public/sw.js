// Service worker of the Refrigeração Castro site (issue #81). Kept small on purpose:
// * the offline page and brand files are cached on install;
// * pages go to the network first; the technician's day (/hoje) is kept for when the signal drops;
// * built assets (/_nuxt/, hashed and immutable) are served from the cache once fetched.
// API data is never cached here: the /hoje page keeps its own copy of the day (see pages/hoje.vue).
const VERSION = 'v1';
const SHELL = `rc-shell-${VERSION}`;
const PAGES = `rc-pages-${VERSION}`;
const ASSETS = `rc-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/illustrations/erro-offline.svg', '/favicon.svg', '/icon-192.png'];
const KEPT_PAGES = ['/hoje'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const current = [SHELL, PAGES, ASSETS];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !current.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function page(request) {
  const url = new URL(request.url);
  const kept = KEPT_PAGES.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
  try {
    const response = await fetch(request);
    if (kept && response.ok) {
      const cache = await caches.open(PAGES);
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const cached = kept ? await caches.match(url.pathname) : undefined;
    return cached ?? (await caches.match(OFFLINE_URL));
  }
}

async function asset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSETS);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith('/_nuxt/') && !url.pathname.includes('/@')) {
    event.respondWith(asset(request));
  }
});
