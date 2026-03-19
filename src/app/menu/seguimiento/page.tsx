"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface Pedido {
  id: number
  order_id: string
  cliente_nombre: string
  cliente_telefono: string
  total: number
  estado: string
  metodo_pago: string
  pago_verificado: boolean
  calificado: boolean
  items: { nombre: string; cantidad: number; subtotal: number }[]
}

const PASOS = [
  { key: "pendiente", label: "Pedido recibido", icon: "📋", desc: "Tu pedido fue enviado al restaurante" },
  { key: "pago_ok", label: "Pago verificado", icon: "💰", desc: "El pago fue confirmado" },
  { key: "preparando", label: "En preparación", icon: "👨‍🍳", desc: "¡Estamos preparando tu pedido!" },
  { key: "listo", label: "¡Listo!", icon: "✅", desc: "Tu pedido está listo para recoger" },
  { key: "entregado", label: "Entregado", icon: "🎉", desc: "¡Gracias por tu pedido!" },
]

function getStepIndex(estado: string, pagoVerificado: boolean, esQr: boolean): number {
  if (estado === "entregado") return 4
  if (estado === "listo") return 3
  if (estado === "preparando") return 2
  if (estado === "pendiente" && pagoVerificado && esQr) return 1
  return 0
}

function SeguimientoContent() {
  const searchParams = useSearchParams()
  const orderId = decodeURIComponent(searchParams.get("order") ?? "")
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [alerted, setAlerted] = useState(false)
  const [tiempoEstimado, setTiempoEstimado] = useState("30-45 min")
  const [rating, setRating] = useState(0)
  const [comentario, setComentario] = useState("")
  const [calificando, setCalificando] = useState(false)
  const [calificado, setCalificado] = useState(false)

  useEffect(() => {
    if (!orderId) return
    loadPedido()
    loadConfig()

    const channel = supabase
      .channel("seg-" + orderId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, (payload) => {
        const u = payload.new as Pedido
        if (u.order_id === orderId) setPedido(u)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  useEffect(() => {
    if (pedido?.estado === "listo" && !alerted) {
      setAlerted(true)
      if (navigator.vibrate) navigator.vibrate([400, 100, 400, 100, 400])
      if (Notification.permission === "granted") {
        new Notification("🍔 ¡Tu pedido está listo!", { body: `${orderId} — Pasa a recogerlo` })
      }
    }
  }, [pedido?.estado, alerted, orderId])

  async function loadPedido() {
    const { data } = await supabase.from("pedidos").select("*").eq("order_id", orderId).single()
    setPedido(data as Pedido)
    setCalificado(data?.calificado || false)
    setLoading(false)
  }

  async function loadConfig() {
    const { data } = await supabase.from("configuracion").select("tiempo_estimado").eq("id", 1).single()
    if (data?.tiempo_estimado) setTiempoEstimado(data.tiempo_estimado)
  }

  async function enviarCalificacion() {
    if (!rating || !pedido) return
    setCalificando(true)
    await supabase.from("resenas").insert({
      pedido_id: pedido.id, order_id: orderId,
      rating, comentario: comentario.trim() || null, cliente_nombre: pedido.cliente_nombre,
    })
    await supabase.from("pedidos").update({ calificado: true }).eq("id", pedido.id)
    setCalificado(true)
    setCalificando(false)
  }

  async function pedirNotificaciones() { await Notification.requestPermission() }

  if (!orderId) return <div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">🔍</p><p>Pedido no encontrado</p></div>
  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Cargando...</p></div>
  if (!pedido) return <div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">❌</p><p>Pedido no encontrado</p></div>

  const esQr = pedido.metodo_pago === "qr"
  const stepIndex = getStepIndex(pedido.estado, pedido.pago_verificado, esQr)
  const isListo = pedido.estado === "listo"
  const isEntregado = pedido.estado === "entregado"
  const isCancelado = pedido.estado === "cancelado"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white sticky top-0 z-40 shadow">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-red-500">Contry Burger</h1>
            <p className="text-xs text-gray-400">⏱ {tiempoEstimado}</p>
          </div>
          <span className="text-sm font-bold">{pedido.order_id}</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Alerta LISTO */}
        {isListo && (
          <div className="bg-green-500 text-white rounded-2xl p-6 text-center shadow-lg">
            <p className="text-6xl mb-2 animate-bounce">🍔</p>
            <p className="text-2xl font-black">¡Tu pedido está listo!</p>
            <p className="text-green-100 mt-1 text-sm">Pasa a recogerlo al restaurante</p>
          </div>
        )}

        {isEntregado && (
          <div className="bg-gray-800 text-white rounded-2xl p-5 text-center">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-xl font-bold">¡Pedido entregado!</p>
            <p className="text-gray-400 text-sm mt-1">Gracias por elegir Contry Burger</p>
          </div>
        )}

        {isCancelado && (
          <div className="bg-red-100 border border-red-300 rounded-xl p-5 text-center">
            <p className="text-4xl mb-2">❌</p>
            <p className="text-red-700 font-bold text-lg">Pedido Cancelado</p>
          </div>
        )}

        {/* Progreso */}
        {!isCancelado && (
          <div className="bg-white rounded-xl border shadow p-5">
            <h3 className="font-semibold text-gray-700 mb-4 text-sm">Estado del pedido</h3>
            <div className="space-y-3">
              {PASOS.map((paso, i) => {
                if (paso.key === "pago_ok" && !esQr) return null
                const done = i <= stepIndex
                const active = i === stepIndex
                return (
                  <div key={paso.key} className={`flex items-start gap-3 transition-all ${done ? "opacity-100" : "opacity-25"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${active ? "bg-red-100 ring-2 ring-red-500" : done ? "bg-green-100" : "bg-gray-100"}`}>
                      {paso.icon}
                    </div>
                    <div className="pt-1 flex-1">
                      <p className={`font-semibold text-sm ${active ? "text-red-600" : "text-gray-700"}`}>{paso.label}</p>
                      {active && <p className="text-xs text-gray-500 mt-0.5">{paso.desc}</p>}
                    </div>
                    {active && <div className="w-2 h-2 bg-red-500 rounded-full animate-ping mt-2 shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info pedido */}
        <div className="bg-white rounded-xl border shadow p-4 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold">{pedido.order_id}</p>
              <p className="text-sm text-gray-500">{pedido.cliente_nombre} · {pedido.cliente_telefono}</p>
            </div>
            <p className="text-xl font-bold text-red-600">${Number(pedido.total).toFixed(2)}</p>
          </div>
          <div className="border-t pt-2 space-y-1">
            {(pedido.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm"><span>{item.cantidad}x {item.nombre}</span><span className="text-gray-500">${item.subtotal.toFixed(2)}</span></div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Pago: {pedido.metodo_pago}</p>
        </div>

        {/* Reseña — solo tras entregado */}
        {isEntregado && !calificado && (
          <div className="bg-white rounded-xl border shadow p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">¿Cómo estuvo tu pedido?</h3>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} className={`text-3xl transition-transform hover:scale-110 ${s <= rating ? "" : "opacity-30"}`}>⭐</button>
              ))}
            </div>
            {rating > 0 && (
              <>
                <textarea
                  placeholder="Cuéntanos tu experiencia (opcional)"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button onClick={enviarCalificacion} disabled={calificando} className="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
                  {calificando ? "Enviando..." : "Enviar calificación"}
                </button>
              </>
            )}
          </div>
        )}

        {isEntregado && calificado && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-2xl mb-1">🙏</p>
            <p className="text-green-700 font-semibold text-sm">¡Gracias por tu calificación!</p>
          </div>
        )}

        {/* Activar notificaciones */}
        {typeof window !== "undefined" && Notification.permission === "default" && !isEntregado && !isCancelado && (
          <button onClick={pedirNotificaciones} className="w-full border-2 border-dashed border-gray-300 text-gray-500 py-3 rounded-xl text-sm hover:border-red-400 hover:text-red-500 transition-colors">
            🔔 Activar notificaciones para saber cuando esté listo
          </button>
        )}

        {!isEntregado && !isCancelado && (
          <p className="text-center text-xs text-gray-400">Esta página se actualiza automáticamente · No la cierres</p>
        )}

        <div className="text-center">
          <a href="/menu" className="text-sm text-red-600 underline">Hacer otro pedido</a>
        </div>
      </div>
    </div>
  )
}

export default function SeguimientoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Cargando...</p></div>}>
      <SeguimientoContent />
    </Suspense>
  )
}
