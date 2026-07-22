// PELOTEAR — Service Worker v1.0
// Maneja cache offline y sincronización en background

const CACHE_NAME = 'pelotear-v1';
const ASSETS_TO_CACHE = [
  '/PeloteAr/',
  '/PeloteAr/index.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'
];

// Instalar: cachear assets esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando assets esenciales');
      return cache.addAll(ASSETS_TO_CACHE).catch(e => {
        console.log('[SW] Algunos assets no se pudieron cachear:', e);
      });
    })
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: estrategia cache-first para assets, network-first para API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: siempre intentar red primero
  if (url.href.includes('railway.app/api')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si falla, devolver respuesta vacía con estado offline
        return new Response(
          JSON.stringify({ ok: false, offline: true }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Assets: cache first, luego red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Cachear respuestas exitosas de assets estáticos
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Si es navegación y no hay cache, devolver index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/PeloteAr/index.html');
        }
      });
    })
  );
});

// Background sync (cuando vuelve internet)
self.addEventListener('sync', (event) => {
  if (event.tag === 'pelotear-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_TRIGGERED' });
        });
      })
    );
  }
});

console.log('[SW] Service Worker de PeloteAr cargado');
