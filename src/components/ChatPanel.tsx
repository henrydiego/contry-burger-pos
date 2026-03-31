"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@/hooks/useChat"

interface PedidoChat {
  id: number
  order_id: string
  cliente_nombre: string
  cliente_telefono: string
  notas?: string | null
}

interface ChatPanelProps {
  pedido: PedidoChat
  onClose: () => void
}

export default function ChatPanel({ pedido, onClose }: ChatPanelProps) {
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
    rol: "admin",
  })

  const [nuevoMensaje, setNuevoMensaje] = useState("")
  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll automatico al final
  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes])

  // Marcar como leidos al abrir
  useEffect(() => {
    marcarComoLeidos()
  }, [marcarComoLeidos])

  // Focus en input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <p className="font-bold">{pedido.order_id}</p>
              <p className="text-xs text-gray-400">{pedido.cliente_nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Indicador de conexion */}
            <div className={`w-2 h-2 rounded-full ${conectado ? "bg-green-400" : "bg-red-400"}`} title={conectado ? "Conectado" : "Sin conexion"} />
            <button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Info del cliente */}
        <div className="bg-gray-50 border-b p-3 text-sm shrink-0">
          <p className="font-semibold">{pedido.cliente_nombre}</p>
          <p className="text-gray-500 text-xs">{pedido.cliente_telefono}</p>
          {pedido.notas && (
            <p className="text-orange-600 text-xs mt-1">📝 {pedido.notas}</p>
          )}
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100">
          {cargando ? (
            <div className="text-center text-gray-400 py-8">
              <p className="animate-pulse">Cargando mensajes...</p>
            </div>
          ) : mensajes.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm">Sin mensajes aun</p>
              <p className="text-xs mt-1">Escribe algo para iniciar la conversacion</p>
            </div>
          ) : (
            mensajes.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.remitente === "admin" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    msg.remitente === "admin"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md shadow"
                  }`}
                >
                  <p className="text-sm">{msg.mensaje}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.remitente === "admin" ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {formatearHora(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={mensajesEndRef} />
        </div>

        {/* Indicador de no leidos */}
        {noLeidos > 0 && (
          <div className="bg-orange-100 border-t border-orange-200 px-4 py-2 text-center shrink-0">
            <p className="text-orange-700 text-sm font-semibold">
              🔔 {noLeidos} mensaje{noLeidos > 1 ? "s" : ""} nuevo{noLeidos > 1 ? "s" : ""}
            </p>
          </div>
        )}

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
          <p className="text-xs text-gray-400 mt-2 text-center">
            Presiona Enter para enviar
          </p>
        </div>
      </div>
    </div>
  )
}