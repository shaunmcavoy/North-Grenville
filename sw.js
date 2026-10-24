// North Grenville Hot Tubs service worker.
// Keeps it simple on purpose: pages always come fresh from the network,
// so prices, stock and the portals are never out of date. The only thing
// stored on the phone is a small "you're offline" page.
var CACHE = 'ng-offline-v1';
var OFFLINE = ['/offline/', '/assets/css/site.css', '/assets/img/logo.webp'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(OFFLINE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(function () { return caches.match('/offline/'); }));
    return;
  }
  var path = new URL(req.url).pathname;
  if (OFFLINE.indexOf(path) > 0) {
    e.respondWith(fetch(req).catch(function () { return caches.match(path); }));
  }
});
