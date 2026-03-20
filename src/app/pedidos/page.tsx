"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import StatCard from "@/components/StatCard"
import html2canvas from "html2canvas"

interface PedidoItem {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Pedido {
  id: number
  order_id: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email: string
  items: PedidoItem[]
  total: number
  estado: string
  metodo_pago: string
  pago_verificado: boolean
  notas: string
  fecha: string
  hora: string
  latitud: number | null
  longitud: number | null
  direccion: string | null
  hora_recojo: string | null
}

const ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: "🕐" },
  { value: "preparando", label: "Preparando", color: "bg-blue-100 text-blue-800", icon: "👨‍🍳" },
  { value: "listo", label: "Listo", color: "bg-green-100 text-green-800", icon: "✅" },
  { value: "entregado", label: "Entregado", color: "bg-gray-100 text-gray-800", icon: "📦" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800", icon: "❌" },
]

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [ticketPedido, setTicketPedido] = useState<Pedido | null>(null)
  const [guardandoImg, setGuardandoImg] = useState(false)
  const [procesando, setProcesando] = useState<Set<number>>(new Set())
  const [alertaTipo, setAlertaTipo] = useState<"normal" | "qr" | null>(null)
  const ultimoIdRef = useRef<number>(0)
  const alertaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function sonarAlerta(esQr: boolean) {
    try {
      const ctx = new AudioContext()
      if (esQr) {
        // 3 pitidos urgentes para QR
        [0, 0.18, 0.36].forEach((t) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(1050, ctx.currentTime + t)
          gain.gain.setValueAtTime(0.45, ctx.currentTime + t)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.14)
          osc.start(ctx.currentTime + t)
          osc.stop(ctx.currentTime + t + 0.14)
        })
      } else {
        // 2 pitidos normales
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      }
    } catch { /* ignorar si no soporta */ }
  }

  async function fetchPedidos() {
    const { data } = await supabase
      .from("pedidos")
      .select("*")
      .order("id", { ascending: false })
      .limit(200)
    const lista = (data as Pedido[]) || []
    setLoading(false)
    if (lista.length === 0) {
      setPedidos([])
      return
    }
    if (ultimoIdRef.current > 0 && lista[0].id > ultimoIdRef.current) {
      const esQr = lista[0].metodo_pago === "qr" && !lista[0].pago_verificado
      sonarAlerta(esQr)
      setAlertaTipo(esQr ? "qr" : "normal")
      if (alertaTimerRef.current) clearTimeout(alertaTimerRef.current)
      alertaTimerRef.current = setTimeout(() => setAlertaTipo(null), 6000)
    }
    ultimoIdRef.current = lista[0].id
    setPedidos(lista)
    setLoading(false)
  }

  useEffect(() => {
    fetchPedidos()

    // Realtime para actualizaciones instantáneas
    const channel = supabase
      .channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, fetchPedidos)
      .subscribe()

    // Polling cada 3s como respaldo garantizado
    const interval = setInterval(fetchPedidos, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      if (alertaTimerRef.current) clearTimeout(alertaTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cambiarEstado(pedidoId: number, nuevoEstado: string) {
    await supabase.from("pedidos").update({ estado: nuevoEstado }).eq("id", pedidoId)
    await fetchPedidos()
  }

  async function verificarPago(pedidoId: number) {
    await supabase.from("pedidos").update({ pago_verificado: true }).eq("id", pedidoId)
    await fetchPedidos()
  }

  // Procesa entrega via RPC atómica en PostgreSQL
  async function entregarYRegistrar(pedido: Pedido) {
    if (procesando.has(pedido.id)) return
    if (pedido.estado === "entregado") return

    setProcesando((prev) => new Set(prev).add(pedido.id))
    try {
      // Verificación doble en servidor antes de procesar
      const { data: estadoActual } = await supabase
        .from("pedidos").select("estado").eq("id", pedido.id).single()
      if (estadoActual?.estado === "entregado") {
        fetchPedidos()
        return
      }

      const { data, error } = await supabase.rpc("procesar_entrega", {
        p_pedido_id: pedido.id,
      })

      if (error) throw error

      if (!data?.ok) {
        alert(`No se pudo procesar: ${data?.error ?? "Error desconocido"}`)
        return
      }

      fetchPedidos()
    } catch (err) {
      console.error(err)
      alert("Error al registrar la entrega")
    } finally {
      setProcesando((prev) => {
        const next = new Set(prev)
        next.delete(pedido.id)
        return next
      })
    }
  }

  const pedidosFiltrados =
    filtroEstado === "todos"
      ? pedidos
      : pedidos.filter((p) => p.estado === filtroEstado)

  const hoy = new Date().toISOString().split("T")[0]
  const pedidosHoy = pedidos.filter((p) => p.fecha === hoy)
  const pendientes = pedidosHoy.filter((p) => p.estado === "pendiente").length
  const preparando = pedidosHoy.filter((p) => p.estado === "preparando").length
  const listos = pedidosHoy.filter((p) => p.estado === "listo").length
  const totalHoy = pedidosHoy.reduce((s, p) => s + (Number(p.total) || 0), 0)

  async function guardarComoImagen(pedido: Pedido) {
    setGuardandoImg(true)
    try {
      const el = document.getElementById("recibo-pedido-print")
      if (!el) return
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 })
      const link = document.createElement("a")
      link.download = `recibo-${pedido.order_id}-${pedido.fecha}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (e) {
      console.error(e)
      alert("Error al guardar imagen")
    } finally {
      setGuardandoImg(false)
    }
  }

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando pedidos...</div>

  return (
    <div className="space-y-4">
      {alertaTipo === "qr" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-black text-base leading-none">¡Pedido QR! Verificar pago</p>
            <p className="text-orange-100 text-xs mt-0.5">El cliente ya transfirió — confirma el pago</p>
          </div>
        </div>
      )}
      {alertaTipo === "normal" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-2xl">🔔</span>
          <span className="font-bold text-lg">¡Nuevo pedido entrante!</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Pedidos Online</h2>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500">Filtrar:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="todos">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Pendientes" value={String(pendientes)} color={pendientes > 0 ? "red" : "green"} icon="🕐" />
        <StatCard title="Preparando" value={String(preparando)} color="blue" icon="👨‍🍳" />
        <StatCard title="Listos" value={String(listos)} color="green" icon="✅" />
        <StatCard title="Ventas Hoy" value={`$${totalHoy.toFixed(2)}`} color="green" icon="💰" />
      </div>

      {pedidosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>No hay pedidos {filtroEstado !== "todos" ? `con estado "${filtroEstado}"` : ""}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidosFiltrados.map((pedido) => {
            const estadoInfo = ESTADOS.find((e) => e.value === pedido.estado) || ESTADOS[0]
            const esQrPendiente = pedido.metodo_pago === "qr" && !pedido.pago_verificado && pedido.estado !== "cancelado"
            return (
              <div key={pedido.id} className={`bg-white rounded-lg shadow overflow-hidden ${esQrPendiente ? "border-2 border-orange-400 ring-2 ring-orange-300/50 animate-pulse-border" : "border"}`}>
                {/* Header */}
                <div className={`text-white p-3 flex items-center justify-between ${esQrPendiente ? "bg-orange-600" : "bg-gray-800"}`}>
                  <div>
                    <p className="font-bold">{pedido.order_id}</p>
                    <p className="text-xs text-gray-400">{pedido.fecha} {pedido.hora}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                    {estadoInfo.icon} {estadoInfo.label}
                  </span>
                </div>

                {/* Client info */}
                <div className="p-3 border-b bg-gray-50">
                  <p className="font-medium text-sm">{pedido.cliente_nombre}</p>
                  <p className="text-xs text-gray-500">{pedido.cliente_telefono}</p>
                  {pedido.cliente_email && (
                    <p className="text-xs text-gray-400">{pedido.cliente_email}</p>
                  )}
                  {pedido.hora_recojo && (
                    <p className="text-xs font-bold text-purple-700 mt-1 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5 inline-block">⏰ Recojo: {pedido.hora_recojo}</p>
                  )}
                  {pedido.notas && (
                    <p className="text-xs text-orange-600 mt-1">Nota: {pedido.notas}</p>
                  )}
                  {/* Ubicación */}
                  {(pedido.latitud || pedido.direccion) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {pedido.latitud && (
                        <a
                          href={`https://www.google.com/maps?q=${pedido.latitud},${pedido.longitud}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full hover:bg-blue-200"
                        >
                          📍 Ver en Maps
                        </a>
                      )}
                      {pedido.direccion && (
                        <span className="text-xs text-gray-600">🏠 {pedido.direccion}</span>
                      )}
                    </div>
                  )}
                  {/* Badge verificacion pago QR */}
                  {pedido.metodo_pago === "qr" && (
                    <div className="mt-2">
                      {pedido.pago_verificado ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                          ✅ Pago QR verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-300">
                          💳 Pago QR — pendiente verificación
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="p-3 space-y-1">
                  {(pedido.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.cantidad}x {item.nombre}</span>
                      <span className="text-gray-600">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-red-600">${Number(pedido.total).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">Pago: {pedido.metodo_pago}</p>
                </div>

                {/* Actions */}
                <div className="p-3 border-t bg-gray-50 flex gap-2 flex-wrap">
                  <button
                    onClick={() => setTicketPedido(pedido)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded text-xs font-semibold mb-1 flex items-center justify-center gap-1"
                  >
                    🧾 Ver / Imprimir Recibo
                  </button>
                  {/* Verificar pago QR */}
                  {pedido.metodo_pago === "qr" && !pedido.pago_verificado && pedido.estado !== "cancelado" && (
                    <button
                      onClick={() => verificarPago(pedido.id)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-bold mb-1 flex items-center justify-center gap-2 shadow-md shadow-orange-200"
                    >
                      💳 Confirmar Pago QR
                    </button>
                  )}
                  {pedido.estado === "pendiente" && (
                    <button
                      onClick={() => cambiarEstado(pedido.id, "preparando")}
                      className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-semibold hover:bg-blue-700"
                    >
                      Preparar
                    </button>
                  )}
                  {pedido.estado === "preparando" && (
                    <button
                      onClick={() => cambiarEstado(pedido.id, "listo")}
                      className="flex-1 bg-green-600 text-white py-2 rounded text-sm font-semibold hover:bg-green-700"
                    >
                      Marcar Listo
                    </button>
                  )}
                  {pedido.estado === "listo" && (
                    <button
                      onClick={() => entregarYRegistrar(pedido)}
                      disabled={procesando.has(pedido.id)}
                      className="flex-1 bg-green-700 text-white py-2 rounded text-sm font-semibold hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {procesando.has(pedido.id) ? "Procesando..." : "Entregar y Registrar Venta"}
                    </button>
                  )}
                  {(pedido.estado === "pendiente" || pedido.estado === "preparando") && (
                    <button
                      onClick={() => cambiarEstado(pedido.id, "cancelado")}
                      className="px-3 py-2 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Modal Recibo Pedido App */}
      {ticketPedido && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #recibo-pedido-print, #recibo-pedido-print * { visibility: visible !important; }
              #recibo-pedido-print {
                position: fixed !important; left: 0 !important; top: 0 !important;
                width: 80mm !important; padding: 6mm !important; font-size: 11px !important;
              }
            }
          `}</style>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            {/* Botones acción */}
            <div className="bg-purple-800 text-white p-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm">Pedido On Line — Recibo</span>
                <p className="text-purple-300 text-xs">{ticketPedido.order_id} · {ticketPedido.cliente_nombre}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-white text-gray-800 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100"
                >
                  🖨️ Imprimir
                </button>
                <button
                  onClick={() => guardarComoImagen(ticketPedido)}
                  disabled={guardandoImg}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                >
                  {guardandoImg ? "..." : "💾 Guardar PNG"}
                </button>
                <button
                  onClick={() => setTicketPedido(null)}
                  className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-500"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Recibo imprimible */}
            <div id="recibo-pedido-print" className="p-5 font-mono text-sm bg-white">
              {/* Header */}
              <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-3">
                <p className="text-xl font-black tracking-wider">CONTRY BURGER</p>
                <div className="inline-block bg-purple-700 text-white text-xs font-black px-3 py-0.5 rounded-full mt-1 mb-1 tracking-widest">
                  PEDIDO ON LINE
                </div>
                <p className="text-xs mt-1">{ticketPedido.fecha} — {ticketPedido.hora}</p>
              </div>

              {/* Ticket number */}
              <div className="text-center mb-3">
                <span className="bg-gray-800 text-white px-4 py-1 rounded text-base font-black tracking-widest">
                  #{ticketPedido.order_id}
                </span>
              </div>

              {/* Cliente */}
              <div className="bg-gray-50 border rounded-lg p-2 mb-3 text-xs space-y-0.5">
                <p><span className="text-gray-500">Cliente:</span> <strong>{ticketPedido.cliente_nombre}</strong></p>
                {ticketPedido.cliente_telefono && <p><span className="text-gray-500">Tel:</span> {ticketPedido.cliente_telefono}</p>}
                {ticketPedido.hora_recojo && <p><span className="text-gray-500">Recojo:</span> <strong>{ticketPedido.hora_recojo}</strong></p>}
                {ticketPedido.direccion && <p><span className="text-gray-500">Direccion:</span> {ticketPedido.direccion}</p>}
                {ticketPedido.notas && <p><span className="text-gray-500">Nota:</span> {ticketPedido.notas}</p>}
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex text-xs text-gray-500 mb-1">
                  <span className="flex-1">PRODUCTO</span>
                  <span className="w-8 text-center">CT</span>
                  <span className="w-14 text-right">P.U.</span>
                  <span className="w-16 text-right">TOTAL</span>
                </div>
                {(ticketPedido.items || []).map((item, i) => (
                  <div key={i} className="flex text-xs py-0.5">
                    <span className="flex-1 truncate">{item.nombre}</span>
                    <span className="w-8 text-center">{item.cantidad}</span>
                    <span className="w-14 text-right">${Number(item.precio_unitario).toFixed(2)}</span>
                    <span className="w-16 text-right font-semibold">${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="space-y-1 mb-3">
                <div className="flex justify-between font-black text-lg border-t-2 border-gray-800 pt-2">
                  <span>TOTAL</span>
                  <span>${Number(ticketPedido.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Pago:</span>
                  <span className={`font-semibold uppercase ${ticketPedido.pago_verificado ? "text-green-600" : "text-orange-600"}`}>
                    {ticketPedido.metodo_pago} {ticketPedido.metodo_pago === "qr" ? (ticketPedido.pago_verificado ? "✅ Verificado" : "⏳ Pendiente") : ""}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Estado:</span>
                  <span className="font-semibold uppercase">{ticketPedido.estado}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-3 border-t border-dashed border-gray-400 text-xs text-gray-500">
                <p>Presente este recibo para retirar su pedido</p>
                <p className="mt-1 font-semibold">¡Gracias por su preferencia!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
