// Service Worker pour H2eaux Gestion
const CACHE_NAME = 'h2eaux-gestion-v1';
const STATIC_CACHE = 'h2eaux-static-v1';

// Ressources à mettre en cache lors de l'installation
const CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation en cours...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Mise en cache des ressources statiques');
        return cache.addAll(CACHE_URLS.map(url => new Request(url, {
          credentials: 'same-origin'
        })));
      })
      .catch((error) => {
        console.error('Service Worker: Erreur lors de la mise en cache:', error);
      })
  );
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation en cours...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('Service Worker: Suppression du cache obsolète:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache : Network First pour les API, Cache First pour les ressources statiques
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }

  // Stratégie pour les appels API (Network First)
  if (request.url.includes('/api/') || request.url.includes('backend')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cloner la réponse car elle ne peut être consommée qu'une fois
          const responseClone = response.clone();
          
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // En cas d'erreur réseau, essayer de récupérer depuis le cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Retourner une réponse par défaut si aucune donnée en cache
            return new Response(
              JSON.stringify({ 
                error: 'Aucune connexion réseau disponible',
                offline: true 
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Stratégie Cache First pour les ressources statiques
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Ne pas mettre en cache les réponses non-OK
        if (!response.ok) {
          return response;
        }

        const responseClone = response.clone();
        
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});

// Gestion des messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notification de mise à jour disponible
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});