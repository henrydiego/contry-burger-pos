"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import ChatCliente from "@/components/ChatCliente"
import { useAlertaSonido } from "@/hooks/useAlertaSonido"

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
  notas: string
  fecha: string
  hora: string
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
  const rawOrderId = searchParams.get("order")
  // El order_id en BD se guarda como #25, #26, etc. (con # incluido)
  // No remover el #, buscar exactamente como está en la URL
  const orderId = rawOrderId ? decodeURIComponent(rawOrderId).trim() : ""

  console.log("[Seguimiento] ===== DEBUG =====")
  console.log("[Seguimiento] URL completa:", typeof window !== 'undefined' ? window.location.href : 'SSR')
  console.log("[Seguimiento] searchParams.get('order'):", rawOrderId)
  console.log("[Seguimiento] orderId procesado:", orderId)
  console.log("[Seguimiento] orderId length:", orderId?.length)
  console.log("[Seguimiento] orderId char codes:", orderId?.split('').map((c: string) => `${c}(${c.charCodeAt(0)})`).join(','))
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [alerted, setAlerted] = useState(false)
  const [tiempoEstimado, setTiempoEstimado] = useState("30-45 min")
  const [rating, setRating] = useState(0)
  const [comentario, setComentario] = useState("")
  const [calificando, setCalificando] = useState(false)
  const [calificado, setCalificado] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState("")

  // Hook para sonido de alerta cuando el pedido está listo
  const { reproducir: reproducirAlerta } = useAlertaSonido()

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

    const interval = setInterval(loadPedido, 8000)

    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    if (pedido?.estado === "listo" && !alerted) {
      setAlerted(true)
      // Sonido de alerta tipo llamada por 15 segundos
      reproducirAlerta({
        duracionSegundos: 15,
        volumen: 0.9,
        frecuenciaBase: 900
      })
      if (navigator.vibrate) navigator.vibrate([400, 100, 400, 100, 400])
      if (Notification.permission === "granted") {
        new Notification("🍔 ¡Tu pedido está listo!", { body: `${orderId} — Pasa a recogerlo` })
      }
    }
  }, [pedido?.estado, alerted, orderId, reproducirAlerta])

  async function loadPedido() {
    try {
      console.log("[Seguimiento] Cargando pedido, orderId=", orderId, "tipo:", typeof orderId)
      if (!orderId) {
        console.log("[Seguimiento] ERROR: orderId está vacío")
        setPedido(null)
        setLoading(false)
        return
      }

      // Intentar buscar por order_id (usar maybeSingle en lugar de single)
      console.log("[Seguimiento] Buscando por order_id:", orderId)
      let { data, error } = await supabase.from("pedidos").select("*").eq("order_id", orderId).maybeSingle()
      console.log("[Seguimiento] Resultado por order_id:", { data, error })

      // Si no se encuentra, intentar buscar por id numérico (sin el #)
      if (!data && orderId.startsWith('#')) {
        const idNumerico = parseInt(orderId.replace('#', ''), 10)
        console.log("[Seguimiento] Fallback: buscando por id numérico:", idNumerico)
        if (!isNaN(idNumerico)) {
          const result = await supabase.from("pedidos").select("*").eq("id", idNumerico).maybeSingle()
          console.log("[Seguimiento] Resultado por id numérico:", { data: result.data, error: result.error })
          data = result.data
          error = result.error
        }
      }

      if (error) {
        console.error("[Seguimiento] Error cargando pedido:", error)
        setPedido(null)
      } else if (!data) {
        console.log("[Seguimiento] Pedido no encontrado en BD:", orderId)
        setPedido(null)
      } else {
        console.log("[Seguimiento] Pedido cargado:", data)
        setPedido(data as Pedido)
        setCalificado(data?.calificado || false)
      }
    } catch (err) {
      console.error("[Seguimiento] Excepción:", err)
      setPedido(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadConfig() {
    const { data } = await supabase.from("configuracion").select("tiempo_estimado, whatsapp_phone").eq("id", 1).single()
    if (data?.tiempo_estimado) setTiempoEstimado(data.tiempo_estimado)
    if (data?.whatsapp_phone) setWhatsappPhone(data.whatsapp_phone)
  }

  async function enviarCalificacion() {
    if (!rating || !pedido) return
    setCalificando(true)
    try {
      const { error } = await supabase.from("resenas").insert({
        pedido_id: pedido.id, order_id: orderId,
        rating, comentario: comentario.trim() || null, cliente_nombre: pedido.cliente_nombre,
      })
      if (error) throw error
      await supabase.from("pedidos").update({ calificado: true }).eq("id", pedido.id)
      setCalificado(true)
    } catch {
      alert("No se pudo enviar la calificación. Intenta de nuevo.")
    } finally {
      setCalificando(false)
    }
  }

  async function pedirNotificaciones() { await Notification.requestPermission() }

  if (!orderId) return <div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">🔍</p><p>Pedido no encontrado</p><p className="text-xs mt-2 text-gray-500">URL: {typeof window !== 'undefined' ? window.location.href : ''}</p></div>
  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Cargando...</p></div>
  if (!pedido) return <div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">❌</p><p>Pedido no encontrado</p><p className="text-sm mt-2">ID: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{orderId}</span></p><p className="text-xs text-gray-500 mt-4">Verifica que el enlace sea correcto</p></div>

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

        {/* Botón WhatsApp para confirmar pago QR */}
        {esQr && !pedido.pago_verificado && !isCancelado && whatsappPhone && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 space-y-3 text-center">
            <p className="text-orange-700 font-bold text-sm">⏳ Pago pendiente de verificación</p>
            <p className="text-orange-600 text-xs">Presiona el botón para notificar tu pago al restaurante</p>
            <a
              href={`https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `💳 *PAGO REALIZADO*\n\nPedido ${orderId}\nCliente: ${pedido.cliente_nombre}\nTotal: $${Number(pedido.total).toFixed(2)}\n\nYa realicé el pago por QR, por favor verificar mi pedido 🙏`
              )}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-xl font-black text-base transition-all active:scale-95 shadow-lg shadow-green-900/20 w-full"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Ya pagué · Confirmar por WhatsApp
            </a>
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

        {/* Chat con el restaurante */}
        {pedido && pedido.estado !== "cancelado" && pedido.estado !== "entregado" && (
          <ChatCliente pedido={pedido} />
        )}
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
