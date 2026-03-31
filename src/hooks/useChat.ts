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

  // Funcion para reproducir sonido de notificacion
  const reproducirSonido = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
      // 2 pitidos suaves para mensaje nuevo
      const tiempos: number[] = [0, 0.12]
      tiempos.forEach((t) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(1000, ctx.currentTime + t)
        gain.gain.setValueAtTime(0.2, ctx.currentTime + t)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.1)
        osc.start(ctx.currentTime + t)
        osc.stop(ctx.currentTime + t + 0.1)
      })
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
    if (!pedidoId || !mensaje.trim()) return false

    setEnviando(true)

    const { error } = await supabase.from("chat_mensajes").insert({
      pedido_id: pedidoId,
      order_id: orderId,
      remitente: rol,
      mensaje: mensaje.trim(),
      leido: false,
    })

    setEnviando(false)

    return !error
  }, [pedidoId, orderId, rol])

  // Configurar Realtime
  useEffect(() => {
    if (!pedidoId) return

    cargarMensajes()

    // Canal de Realtime para mensajes nuevos
    const channel = supabase
      .channel(`chat-${pedidoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_mensajes",
          filter: `pedido_id=eq.${pedidoId}`,
        },
        (payload) => {
          const nuevoMensaje = payload.new as ChatMensaje

          setMensajes((prev) => [...prev, nuevoMensaje])

          if (nuevoMensaje.remitente !== rol) {
            setNoLeidos((prev) => prev + 1)
            reproducirSonido()
            onNuevoMensaje?.(nuevoMensaje)
          }
        }
      )
      .subscribe((status) => {
        setConectado(status === 'SUBSCRIBED')
      })

    canalRef.current = channel

    // Polling como respaldo
    const interval = setInterval(cargarMensajes, 5000)

    return () => {
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