const CACHE_NAME = "contry-burger-v1"

const urlsToCache = [
  "/",
  "/menu",
  "/menu/seguimiento",
  "/menu/mis-pedidos",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]

// Instalar el service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    })
  )
  self.skipWaiting()
})

// Activar el service worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Interceptar peticiones
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Devolver de caché o hacer fetch
      if (response) {
        return response
      }
      return fetch(event.request).catch(() => {
        // Si falla la red y es una página, devolver offline
        if (event.request.mode === "navigate") {
          return caches.match("/menu")
        }
      })
    })
  )
})
