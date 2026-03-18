// NewsTally Service Worker v3 — No news caching
const CACHE = 'newstally-v3';
// Only cache app shell files — NOT news data
const STATIC = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — cache ONLY HTML shell, everything else network-first
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always skip external APIs — Firebase, Google, CDN
  const skip = ['firebase', 'googleapis', 'gstatic', 'postimg', 'cdnjs',
                'cloudflare', 'fontawesome', 'newsdata', 'gnews', 'sheets'];
  if (skip.some(s => url.hostname.includes(s))) return;
  if (url.origin !== location.origin) return;

  // Network-first for all same-origin requests
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Only cache HTML shell files
        if (res.ok && e.request.method === 'GET' &&
            (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/manifest.json')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline fallback — only for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'NewsTally', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'NewsTally', {
      body: data.body || 'New update!',
      icon: 'https://i.postimg.cc/dLTgRxbL/cropped-circle-image.png',
      badge: 'https://i.postimg.cc/dLTgRxbL/cropped-circle-image.png',
      data: { url: data.url || '/' },
      tag: 'newstally-notif',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
