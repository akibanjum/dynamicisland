/**
 * Dynamic Island PWA - Service Worker
 * Version: 1.0.0
 * 
 * Provides offline caching, asset precaching, and instant loading
 * across desktop and mobile devices.
 */

const CACHE_NAME = 'dynamic-island-v1';

// Core assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

// Install Event: Precaches essential static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll for atomic cache population
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some assets could not be precached during install:', err);
      });
    }).then(() => {
      // Force the waiting service worker to become active immediately
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clean up outdated caches and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('[ServiceWorker] Removing legacy cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      // Become available to all open tabs immediately without reloading
      return self.clients.claim();
    })
  );
});

// Fetch Event: Cache-First strategy with Network Fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests, ignore browser-extension or chrome-extension URLs
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset immediately
        return cachedResponse;
      }

      // Fallback to network request
      return fetch(event.request)
        .then((networkResponse) => {
          // If invalid or not successful response, return it as is
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone response before caching (body streams can only be consumed once)
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation / HTML requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// Listen for custom messages from clients (e.g. manual skipWaiting triggers)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
