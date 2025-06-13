const CACHE_NAME = 'bakery-pos-v2'; // Changed from v1 to force cache update
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  // Add your icon files (must exist in your project)
  './icons/icon-144.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Cache Font Awesome (for icons)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});