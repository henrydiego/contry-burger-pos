"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { ChatMensaje } from "@/lib/types"

interface UseChatOptions {
  pedidoId: number | null
  orderId: string
  rol: 'admin' | 'cliente'
  onNuevoMensaje?: (mensaje: ChatMensaje) => void
}

export function useChat({ pedidoId, orderId, rol, onNuevoMensaje }: UseChatOptions) {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [noLeidos, setNoLeidos] = useState(0)
  const [conectado, setConectado] = useState(false)

  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const mountedRef = useRef(true)

  // Funcion para reproducir sonido de notificacion
  const reproducirSonido = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
      // 3 tonos ascendentes fuertes para mensaje nuevo
      ;[0, 0.15, 0.30].forEach((t, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(700 + i * 250, ctx.currentTime + t)
        gain.gain.setValueAtTime(0.45, ctx.currentTime + t)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.13)
        osc.start(ctx.currentTime + t)
        osc.stop(ctx.currentTime + t + 0.13)
      })
      // Vibrar en moviles
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      // Cerrar AudioContext después de que terminen los sonidos
      setTimeout(() => ctx.close().catch(() => {}), 600)
    } catch {
      // Ignorar si no soporta audio
    }
  }, [])

  // Cargar mensajes historicos
  const cargarMensajes = useCallback(async () => {
    if (!pedidoId) return

    const { data, error } = await supabase
      .from("chat_mensajes")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true })

    if (!error && data) {
      const msgs = data as ChatMensaje[]
      const noLeidosCount = msgs.filter(
        (m) => m.remitente !== rol && !m.leido
      ).length

      setMensajes(msgs)
      setNoLeidos(noLeidosCount)
      setCargando(false)
    }
  }, [pedidoId, rol])

  // Marcar mensajes como leidos
  const marcarComoLeidos = useCallback(async () => {
    if (!pedidoId) return

    await supabase
      .from("chat_mensajes")
      .update({ leido: true })
      .eq("pedido_id", pedidoId)
      .eq("remitente", rol === 'admin' ? 'cliente' : 'admin')
      .eq("leido", false)

    setNoLeidos(0)
  }, [pedidoId, rol])

  // Enviar mensaje
  const enviarMensaje = useCallback(async (mensaje: string) => {
    if (!pedidoId || !mensaje.trim()) {
      console.error('[Chat] Error: pedidoId o mensaje vacio')
      return false
    }

    setEnviando(true)

    try {
      console.log(`[Chat ${rol}] Enviando mensaje:`, { pedidoId, orderId, remitente: rol, mensaje: mensaje.trim() })
      const { data, error } = await supabase.from("chat_mensajes").insert({
        pedido_id: pedidoId,
        order_id: orderId,
        remitente: rol,
        mensaje: mensaje.trim(),
        leido: false,
      }).select().single()

      if (error) {
        console.error(`[Chat ${rol}] Error al enviar:`, error)
        setEnviando(false)
        return false
      }

      // Optimistic update: agregar mensaje al estado local inmediatamente
      if (data) {
        setMensajes((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data as ChatMensaje]
        })
      }

      console.log(`[Chat ${rol}] Mensaje enviado exitosamente`)
      setEnviando(false)
      return true
    } catch (err) {
      console.error(`[Chat ${rol}] Excepcion al enviar:`, err)
      setEnviando(false)
      return false
    }
  }, [pedidoId, orderId, rol])

  // Configurar Realtime
  useEffect(() => {
    if (!pedidoId) return

    // Marcar como montado
    mountedRef.current = true

    console.log(`[Chat ${rol}] Iniciando chat para pedido ${pedidoId}`)
    cargarMensajes()

    // Canal de Realtime para mensajes nuevos
    // IMPORTANTE: El nombre del canal debe ser el mismo para admin y cliente
    const channel = supabase
      .channel(`chat-pedido-${pedidoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensajes",
          filter: `pedido_id=eq.${pedidoId}`,
        },
        (payload) => {
          console.log(`[Chat ${rol}] Nuevo mensaje recibido:`, payload)
          const nuevoMensaje = payload.new as ChatMensaje

          // Solo actualizar si el componente sigue montado
          if (!mountedRef.current) return

          setMensajes((prev) => {
            // Evitar duplicados
            if (prev.some((m) => m.id === nuevoMensaje.id)) {
              return prev
            }
            return [...prev, nuevoMensaje]
          })

          if (nuevoMensaje.remitente !== rol) {
            setNoLeidos((prev) => prev + 1)
            reproducirSonido()
            onNuevoMensaje?.(nuevoMensaje)
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Chat ${rol}] Estado conexion:`, status, err)
        // Solo actualizar estado si el componente sigue montado
        if (mountedRef.current) {
          setConectado(status === 'SUBSCRIBED')
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(`[Chat ${rol}] Error en canal:`, err)
        }
      })

    canalRef.current = channel

    // Polling mas frecuente como respaldo
    const interval = setInterval(() => {
      if (mountedRef.current) cargarMensajes()
    }, 3000)

    return () => {
      console.log(`[Chat ${rol}] Limpiando suscripcion`)
      mountedRef.current = false
      if (canalRef.current) {
        supabase.removeChannel(canalRef.current)
      }
      clearInterval(interval)
    }
  }, [pedidoId, rol, cargarMensajes, reproducirSonido, onNuevoMensaje])

  return {
    mensajes,
    cargando,
    enviando,
    noLeidos,
    conectado,
    enviarMensaje,
    marcarComoLeidos,
    cargarMensajes,
  }
}