// NewsTally Service Worker — Offline & Performance
const CACHE_NAME = 'newstally-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip Firebase, CDN, external APIs
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('postimg') ||
      url.hostname.includes('cloudflare') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('sheets.googleapis')) {
    return; // Let browser handle directly
  }

  // Cache-first for same-origin static assets (CSS, JS, fonts)
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback — return cached index.html for navigation
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'NewsTally', {
      body: data.body || 'New update on Socialgati!',
      icon: 'https://i.postimg.cc/dLTgRxbL/cropped-circle-image.png',
      badge: 'https://i.postimg.cc/dLTgRxbL/cropped-circle-image.png',
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
