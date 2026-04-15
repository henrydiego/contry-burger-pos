const CACHE_NAME = "contry-burger-v2"

const urlsToCache = [
  "/",
  "/menu",
  "/menu/seguimiento",
  "/menu/mis-pedidos",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/sounds/alert-ring.mp3",
  "/sounds/alert-ring-qr.mp3",
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
      if (response) {
        return response
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("/menu")
        }
      })
    })
  )
})

// ============================================
// SISTEMA DE ALERTAS DE PEDIDOS - BACKGROUND
// ============================================

let audioInterval = null
let audioTimeout = null

// Función para generar sonido tipo llamada usando Web Audio API en el SW
function reproducirSonidoLlamada(tipo = 'normal') {
  const frecuenciaBase = tipo === 'qr' ? 1000 : 800
  const volumen = tipo === 'qr' ? 1.0 : 0.9

  // Crear un patrón de sonido similar al hook
  const reproducirCiclo = () => {
    self.registration.showNotification(
      tipo === 'qr' ? '💳 Pedido QR Pendiente!' : '🍔 Nuevo Pedido!',
      {
        body: tipo === 'qr'
          ? 'Verifica el pago QR inmediatamente'
          : 'Tienes un nuevo pedido entrante',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'pedido-sonido',
        requireInteraction: true,
        silent: false,
        vibrate: [500, 200, 500, 200, 500, 200, 1000],
        data: { tipo, timestamp: Date.now() }
      }
    )
  }

  // Primera notificación inmediata
  reproducirCiclo()

  // Repetir cada 1.5 segundos para simular el sonido continuo
  audioInterval = setInterval(reproducirCiclo, 1500)

  // Auto-detener después de 30 segundos (más tiempo para background)
  audioTimeout = setTimeout(() => {
    detenerSonidoLlamada()
  }, 30000)
}

function detenerSonidoLlamada() {
  if (audioInterval) {
    clearInterval(audioInterval)
    audioInterval = null
  }
  if (audioTimeout) {
    clearTimeout(audioTimeout)
    audioTimeout = null
  }
}

// Escuchar mensajes desde la página principal
self.addEventListener('message', (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'INICIAR_ALERTA_PEDIDO':
      detenerSonidoLlamada() // Detener cualquier alerta anterior
      reproducirSonidoLlamada(data?.tipo || 'normal')
      break

    case 'DETENER_ALERTA_PEDIDO':
      detenerSonidoLlamada()
      break

    case 'KEEP_ALIVE':
      // Responder para mantener la conexión viva
      event.source?.postMessage({ type: 'KEEP_ALIVE_ACK' })
      break

    case 'SKIP_WAITING':
      self.skipWaiting()
      break
  }
})

// Push notifications (para cuando implementemos push server)
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const tipo = data.tipo || 'normal'

  // Mostrar notificación
  const options = {
    body: data.body || 'Nuevo pedido entrante',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'nuevo-pedido',
    requireInteraction: true,
    silent: false,
    vibrate: [500, 200, 500, 200, 500, 200, 1000],
    data: data,
    actions: [
      {
        action: 'ver-pedidos',
        title: 'Ver Pedidos'
      },
      {
        action: 'descartar',
        title: 'Descartar'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(
      tipo === 'qr' ? '💳 Pedido QR Pendiente!' : '🍔 Nuevo Pedido!',
      options
    )
  )

  // Iniciar sonido de alerta
  reproducirSonidoLlamada(tipo)
})

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = event.action
  const data = event.notification.data

  if (action === 'descartar') {
    detenerSonidoLlamada()
    return
  }

  // Abrir o enfocar la ventana de pedidos
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Intentar encontrar una ventana existente
      for (const client of clientList) {
        if (client.url.includes('/pedidos') || client.url.includes('/')) {
          client.focus()
          // Notificar a la página que hay un nuevo pedido
          client.postMessage({
            type: 'NUEVO_PEDIDO_BACKGROUND',
            data: data
          })
          return
        }
      }

      // Si no hay ventana, abrir una nueva
      self.clients.openWindow('/pedidos')
    })
  )

  // Detener el sonido al hacer clic
  detenerSonidoLlamada()
})

// Mantener el service worker activo
self.addEventListener('sync', (event) => {
  if (event.tag === 'keep-alive') {
    event.waitUntil(Promise.resolve())
  }
})
