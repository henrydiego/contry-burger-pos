"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@/hooks/useChat"

interface PedidoChat {
  id: number
  order_id: string
}

interface ChatClienteProps {
  pedido: PedidoChat
}

export default function ChatCliente({ pedido }: ChatClienteProps) {
  const {
    mensajes,
    cargando,
    enviando,
    noLeidos,
    conectado,
    enviarMensaje,
    marcarComoLeidos,
  } = useChat({
    pedidoId: pedido.id,
    orderId: pedido.order_id,
    rol: "cliente",
  })

  const [nuevoMensaje, setNuevoMensaje] = useState("")
  const [abierto, setAbierto] = useState(false)
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll automático al final
  useEffect(() => {
    if (abierto) {
      mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [mensajes, abierto])

  // Marcar como leídos al abrir
  useEffect(() => {
    if (abierto) {
      marcarComoLeidos()
      inputRef.current?.focus()
    }
  }, [abierto, marcarComoLeidos])

  // Sonido para mensajes nuevos cuando está cerrado
  useEffect(() => {
    if (!abierto && noLeidos > 0) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(800, ctx.currentTime)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.2)
      } catch {
        // Ignorar si no soporta audio
      }
    }
  }, [noLeidos, abierto])

  const handleEnviar = async () => {
    if (!nuevoMensaje.trim() || enviando) return

    const enviado = await enviarMensaje(nuevoMensaje)
    if (enviado) {
      setNuevoMensaje("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const formatearHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Mini botón flotante cuando está cerrado
  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="fixed bottom-20 right-4 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg z-40 transition-transform hover:scale-105 active:scale-95"
        aria-label="Abrir chat"
      >
        <span className="text-2xl">💬</span>
        {noLeidos > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
            {noLeidos > 9 ? "9+" : noLeidos}
          </span>
        )}
      </button>
    )
  }

  // Chat abierto
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-md mx-auto flex flex-col overflow-hidden max-h-[70vh]">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <p className="font-bold">Chat con el restaurante</p>
              <p className="text-xs text-gray-400">
                {conectado ? "En linea" : "Conectando..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAbierto(false)}
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors"
            aria-label="Cerrar chat"
          >
            ✕
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100 min-h-[300px] max-h-[400px]">
          {cargando ? (
            <div className="text-center text-gray-400 py-8">
              <p className="animate-pulse">Cargando mensajes...</p>
            </div>
          ) : mensajes.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-4xl mb-2">👋</p>
              <p className="text-sm">Bienvenido al chat</p>
              <p className="text-xs mt-1">
                Escribe un mensaje si tienes alguna pregunta sobre tu pedido
              </p>
            </div>
          ) : (
            mensajes.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.remitente === "cliente" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    msg.remitente === "cliente"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md shadow"
                  }`}
                >
                  <p className="text-sm">{msg.mensaje}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.remitente === "cliente"
                        ? "text-blue-200"
                        : "text-gray-400"
                    }`}
                  >
                    {formatearHora(msg.created_at)}
                    {msg.remitente === "cliente" && (
                      <span className="ml-1">
                        {msg.leido ? "✓✓" : "✓"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={mensajesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-white shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Escribe un mensaje..."
              disabled={enviando}
              className="flex-1 border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
              onClick={handleEnviar}
              disabled={!nuevoMensaje.trim() || enviando}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {enviando ? "..." : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
