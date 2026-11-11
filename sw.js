/* ===========================================================
   Cookie's Top — Service Worker (PWA / offline)
   =========================================================== */

'use strict';

var CACHE_NAME = 'cookiestop-v4';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/store.js',
  './js/app.js',
  './js/pwa.js',
  './assets/logo.svg',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png'
];

/* ---------- instalação ---------- */

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
  );
});

/* ---------- ativação ---------- */

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== CACHE_NAME && key.indexOf('cookiestop-') === 0) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ---------- mensagens (atualização) ---------- */

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- interceptação de requisições ---------- */

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* Navegação: tenta a rede e cai para o index em cache (offline). */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put('./index.html', copy); });
          }
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  /* Demais arquivos: responde do cache e atualiza em segundo plano. */
  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request)
        .then(function (response) {
          if (response && (response.ok || response.type === 'opaque')) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });

      return cached || network;
    })
  );
});
