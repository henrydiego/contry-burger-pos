"use client"

import { useRef, useCallback, useEffect, useState } from "react"

interface AlertaOptions {
  duracionSegundos?: number
  volumen?: number
  frecuenciaBase?: number
  tipo?: "normal" | "qr"
}

interface PedidoInfo {
  order_id: string
  cliente_nombre: string
  total: number
}

/**
 * Hook mejorado para alertas de pedidos que funcionan incluso en background
 * - Usa Wake Lock API para mantener la pantalla activa
 * - Comunicación con Service Worker para sonidos en background
 * - Sistema keep-alive para mantener el audio contexto
 * - Notificaciones nativas persistentes
 */
export function useAlertaPedidos() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodesRef = useRef<GainNode[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const [tienePermisoNotificacion, setTienePermisoNotificacion] = useState(false)
  const [tieneWakeLock, setTieneWakeLock] = useState(false)

  // Inicializar Service Worker y permisos
  useEffect(() => {
    if (typeof window === "undefined") return

    // Obtener referencia al Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        swRegistrationRef.current = registration
      })
    }

    // Verificar permiso de notificaciones
    if ("Notification" in window) {
      setTienePermisoNotificacion(Notification.permission === "granted")
    }

    // Cleanup al desmontar
    return () => {
      detener()
      liberarWakeLock()
    }
  }, [])

  // Solicitar permiso de notificaciones
  const solicitarPermisoNotificaciones = useCallback(async () => {
    if (!("Notification" in window)) return false

    const permission = await Notification.requestPermission()
    setTienePermisoNotificacion(permission === "granted")
    return permission === "granted"
  }, [])

  // Solicitar Wake Lock (mantener pantalla activa)
  const solicitarWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) {
      console.log("Wake Lock API no disponible en este navegador")
      return false
    }

    try {
      // @ts-ignore - Wake Lock puede no estar en todos los navegadores
      const wakeLock = await navigator.wakeLock.request("screen")
      wakeLockRef.current = wakeLock
      setTieneWakeLock(true)

      // Manejar cuando se libera el wake lock
      wakeLock.addEventListener("release", () => {
        setTieneWakeLock(false)
        wakeLockRef.current = null
      })

      return true
    } catch (err) {
      console.log("No se pudo obtener Wake Lock:", err)
      return false
    }
  }, [])

  // Liberar Wake Lock
  const liberarWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
      setTieneWakeLock(false)
    }
  }, [])

  // Sistema keep-alive para mantener el SW activo
  const iniciarKeepAlive = useCallback(() => {
    // Enviar ping cada 20 segundos al SW
    keepAliveIntervalRef.current = setInterval(() => {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "KEEP_ALIVE" })
      }
    }, 20000)
  }, [])

  const detenerKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current)
      keepAliveIntervalRef.current = null
    }
  }, [])

  // Detener sonido actual
  const detener = useCallback(() => {
    // Detener intervalos y timeouts
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Detener todos los osciladores
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop()
        osc.disconnect()
      } catch {
        /* ignorar si ya está detenido */
      }
    })
    oscillatorsRef.current = []

    // Desconectar gains
    gainNodesRef.current.forEach((gain) => {
      try {
        gain.disconnect()
      } catch {
        /* ignorar */
      }
    })
    gainNodesRef.current = []

    // Cerrar contexto
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch {
        /* ignorar */
      }
      audioContextRef.current = null
    }

    // También detener en el Service Worker
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "DETENER_ALERTA_PEDIDO" })
    }

    detenerKeepAlive()
  }, [detenerKeepAlive])

  // Reproducir sonido de alerta
  const reproducir = useCallback(
    async (options: AlertaOptions = {}, pedidoInfo?: PedidoInfo) => {
      const {
        duracionSegundos = 15,
        volumen = 0.8,
        frecuenciaBase = 800,
        tipo = "normal",
      } = options

      // Detener cualquier sonido anterior
      detener()

      // Solicitar Wake Lock para mantener pantalla activa
      await solicitarWakeLock()

      // Iniciar keep-alive
      iniciarKeepAlive()

      // Notificar al Service Worker para que también reproduzca (funciona en background)
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "INICIAR_ALERTA_PEDIDO",
          data: { tipo, pedidoInfo },
        })
      }

      // Mostrar notificación nativa (funciona con página minimizada)
      if (Notification.permission === "granted") {
        const title =
          tipo === "qr" ? "💳 ¡Pedido QR Pendiente!" : "🍔 ¡Nuevo Pedido!"
        const body = pedidoInfo
          ? `Pedido ${pedidoInfo.order_id} - ${pedidoInfo.cliente_nombre}\nTotal: $${pedidoInfo.total.toFixed(2)}`
          : tipo === "qr"
            ? "Nuevo pedido con pago QR - Verifica el pago"
            : "Nuevo pedido entrante"

        try {
          const notification = new Notification(title, {
            body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: "nuevo-pedido",
            requireInteraction: true,
            silent: false,
          })

          notification.onclick = () => {
            window.focus()
            notification.close()
          }
        } catch (e) {
          // Fallback para móviles que no soportan new Notification
          if (swRegistrationRef.current?.showNotification) {
            swRegistrationRef.current.showNotification(title, {
              body,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: "nuevo-pedido",
              requireInteraction: true,
              data: { tipo, vibrate: [500, 200, 500, 200, 500] }
            } as any)
          }
        }
      }

      // Reproducir sonido local (Web Audio API)
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextRef.current = ctx

        // Función para crear un ciclo de sonido tipo "ringtone"
        const reproducirCiclo = () => {
          const now = ctx.currentTime

          // Primer tono del ring (más alto)
          const osc1 = ctx.createOscillator()
          const gain1 = ctx.createGain()
          osc1.type = "sine"
          osc1.frequency.setValueAtTime(frecuenciaBase + 400, now)
          osc1.frequency.exponentialRampToValueAtTime(frecuenciaBase + 200, now + 0.15)
          gain1.gain.setValueAtTime(volumen, now)
          gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
          osc1.connect(gain1)
          gain1.connect(ctx.destination)
          osc1.start(now)
          osc1.stop(now + 0.4)
          oscillatorsRef.current.push(osc1)
          gainNodesRef.current.push(gain1)

          // Segundo tono del ring (más bajo)
          const osc2 = ctx.createOscillator()
          const gain2 = ctx.createGain()
          osc2.type = "sine"
          osc2.frequency.setValueAtTime(frecuenciaBase + 200, now + 0.45)
          osc2.frequency.exponentialRampToValueAtTime(frecuenciaBase, now + 0.6)
          gain2.gain.setValueAtTime(volumen, now + 0.45)
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.9)
          osc2.connect(gain2)
          gain2.connect(ctx.destination)
          osc2.start(now + 0.45)
          osc2.stop(now + 0.9)
          oscillatorsRef.current.push(osc2)
          gainNodesRef.current.push(gain2)
        }

        // Reproducir inmediatamente
        reproducirCiclo()

        // Repetir cada 1.5 segundos (patrón ring-ring)
        intervalRef.current = setInterval(reproducirCiclo, 1500)

        // Auto-detener después de la duración
        timeoutRef.current = setTimeout(() => {
          detener()
          liberarWakeLock()
        }, duracionSegundos * 1000)

        return true
      } catch (error) {
        console.error("Error al reproducir sonido:", error)
        // Si falla el audio local, al menos tenemos las notificaciones del SW
        return true
      }
    },
    [detener, solicitarWakeLock, iniciarKeepAlive, liberarWakeLock]
  )

  return {
    reproducir,
    detener,
    solicitarPermisoNotificaciones,
    solicitarWakeLock,
    liberarWakeLock,
    tienePermisoNotificacion,
    tieneWakeLock,
  }
}
