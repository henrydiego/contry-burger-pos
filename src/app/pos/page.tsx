"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Producto, Receta, Inventario } from "@/lib/types"
import html2canvas from "html2canvas"
import { type Role } from "@/lib/roles"

interface CartItem {
  producto_id: string
  nombre: string
  categoria: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  costo_unitario: number
  costo_total: number
}

interface StockAlert {
  ingrediente: string
  stock_actual: number
  stock_minimo: number
  unidad: string
}

interface TicketData {
  orderId: string
  cajero: string
  items: CartItem[]
  total: number
  metodoPago: string
  fecha: string
  hora: string
  montoRecibido?: number
  cambio?: number
}

export default function POSPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [inventario, setInventario] = useState<Inventario[]>([])
  const [carrito, setCarrito] = useState<CartItem[]>([])
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [cajero, setCajero] = useState("")
  const [userRole, setUserRole] = useState<Role | undefined>(undefined)
  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [orderId, setOrderId] = useState("")

  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [guardandoImg, setGuardandoImg] = useState(false)
  const [montoRecibido, setMontoRecibido] = useState("")
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null) // null = loading

  const generateOrderId = useCallback(async () => {
    const { data } = await supabase
      .from("ventas")
      .select("order_id")
      .order("id", { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      const last = String(data[0].order_id || "ORD000")
      const num = parseInt(last.replace("ORD", "")) || 0
      return `ORD${String(num + 1).padStart(3, "0")}`
    }
    return "ORD001"
  }, [])

  // Calcular costo real de un producto usando recetas + costo_promedio
  function calcularCostoProducto(productoId: string): number {
    const recetasProducto = recetas.filter((r) => r.producto_id === productoId)
    let costoTotal = 0
    for (const rec of recetasProducto) {
      const ing = inventario.find((i) => i.ingrediente_id === rec.ingrediente_id)
      if (ing) {
        costoTotal += rec.cantidad * (Number(ing.costo_promedio) || 0)
      }
    }
    return costoTotal
  }

  useEffect(() => {
    loadData()
    // Auto-fill cajero name from session
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.app_metadata?.role as Role | undefined
      setUserRole(role)
      if (role === 'cajero') {
        const email = data.user?.email || ''
        const name = data.user?.user_metadata?.full_name || email.split('@')[0]
        setCajero(name)
      }
    })

  }, [])

  async function loadData() {
    const hoy = new Date().toISOString().split("T")[0]
    const [prodRes, recRes, invRes, cajaRes] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true).order("categoria"),
      supabase.from("recetas").select("*"),
      supabase.from("inventario").select("*"),
      supabase.from("caja_diaria").select("id, estado").eq("fecha", hoy).limit(1),
    ])
    setProductos(prodRes.data || [])
    setRecetas(recRes.data || [])
    setInventario(invRes.data || [])
    const caja = cajaRes.data?.[0]
    setCajaAbierta(!!caja) // Solo bloquear si NO existe caja del día
    const newId = await generateOrderId()
    setOrderId(newId)
    setLoading(false)
  }

  const categorias = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoria)))]

  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = categoriaFiltro === "Todos" || p.categoria === categoriaFiltro
    return matchBusqueda && matchCategoria
  })

  function agregarAlCarrito(producto: Producto) {
    const costoUnit = calcularCostoProducto(producto.id)
    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto_id === producto.id)
      if (existe) {
        const nuevaCant = existe.cantidad + 1
        return prev.map((item) =>
          item.producto_id === producto.id
            ? {
                ...item,
                cantidad: nuevaCant,
                subtotal: nuevaCant * item.precio_unitario,
                costo_total: nuevaCant * item.costo_unitario,
              }
            : item
        )
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          subtotal: producto.precio_venta,
          costo_unitario: costoUnit,
          costo_total: costoUnit,
        },
      ]
    })
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.producto_id !== productoId) return item
          const nuevaCantidad = item.cantidad + delta
          if (nuevaCantidad <= 0) return null
          return {
            ...item,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * item.precio_unitario,
            costo_total: nuevaCantidad * item.costo_unitario,
          }
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  function quitarDelCarrito(productoId: string) {
    setCarrito((prev) => prev.filter((item) => item.producto_id !== productoId))
  }

  const total = carrito.reduce((s, item) => s + item.subtotal, 0)
  const costoTotal = carrito.reduce((s, item) => s + item.costo_total, 0)
  const utilidad = total - costoTotal
  const montoNum = parseFloat(montoRecibido) || 0
  const cambio = montoNum - total

  async function procesarVenta() {
    if (carrito.length === 0) return
    if (!cajero.trim()) {
      alert("Ingresa el nombre del cajero")
      return
    }
    setProcesando(true)
    try {
      const hoy = new Date().toISOString().split("T")[0]
      const hora = new Date().toTimeString().split(" ")[0]

      // 1. Insert each item as a separate row in ventas
      const ventaRows = carrito.map((item) => ({
        order_id: orderId,
        producto_id: item.producto_id,
        producto: item.nombre,
        categoria: item.categoria,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        total: item.subtotal,
        metodo_pago: metodoPago,
        cajero: cajero.trim(),
        estado: "completada",
        hora,
        fecha: hoy,
      }))

      const { error } = await supabase.from("ventas").insert(ventaRows)
      if (error) throw error

      // 2. Deduct inventory in background (non-blocking)
      const alertasNuevas: StockAlert[] = []
      const carritoSnapshot = [...carrito]
      const recetasSnapshot = [...recetas]

      // Fire-and-forget: update inventory without blocking the sale
      ;(async () => {
        try {
          // Aggregate all ingredient deductions first
          const deductions: Record<string, number> = {}
          for (const item of carritoSnapshot) {
            const recetasProducto = recetasSnapshot.filter((r) => r.producto_id === item.producto_id)
            for (const rec of recetasProducto) {
              const key = rec.ingrediente_id
              deductions[key] = (deductions[key] || 0) + rec.cantidad * item.cantidad
            }
          }

          // Update all ingredients in parallel
          const updates = Object.entries(deductions).map(async ([ingredienteId, cantidadDescontar]) => {
            const { data: invData } = await supabase
              .from("inventario")
              .select("consumo_total, stock_actual, stock_minimo, nombre, unidad")
              .eq("ingrediente_id", ingredienteId)
              .single()
            if (invData) {
              const nuevoConsumo = (Number(invData.consumo_total) || 0) + cantidadDescontar
              const nuevoStock = (Number(invData.stock_actual) || 0) - cantidadDescontar
              await supabase
                .from("inventario")
                .update({
                  consumo_total: nuevoConsumo,
                  stock_actual: Math.max(0, nuevoStock),
                  ultima_actualizacion: new Date().toISOString(),
                })
                .eq("ingrediente_id", ingredienteId)

              if (nuevoStock <= (Number(invData.stock_minimo) || 0)) {
                alertasNuevas.push({
                  ingrediente: invData.nombre,
                  stock_actual: Math.max(0, nuevoStock),
                  stock_minimo: Number(invData.stock_minimo) || 0,
                  unidad: invData.unidad,
                })
              }
            }
          })
          await Promise.all(updates)

          if (alertasNuevas.length > 0) {
            console.warn("Alerta de Inventario Bajo:", alertasNuevas)
          }
          // Refresh inventory data
          const { data: invRefresh } = await supabase.from("inventario").select("*")
          if (invRefresh) setInventario(invRefresh)
        } catch (e) {
          console.error("Error actualizando inventario:", e)
        }
      })()

      // 3. Update caja_diaria (must be opened first via /caja)
      const ventaEfectivo = metodoPago === "efectivo" ? total : 0
      const ventaTarjeta = metodoPago === "tarjeta" ? total : 0
      const ventaQr = metodoPago === "qr" ? total : 0

      const { data: cajaExistente } = await supabase
        .from("caja_diaria")
        .select("*")
        .eq("fecha", hoy)
        .limit(1)

      if (cajaExistente && cajaExistente.length > 0) {
        const caja = cajaExistente[0]
        const newEfectivo = (Number(caja.ventas_efectivo) || 0) + ventaEfectivo
        const newTarjeta = (Number(caja.ventas_tarjeta) || 0) + ventaTarjeta
        const newQr = (Number(caja.ventas_qr) || 0) + ventaQr
        const newTotalIngresos = newEfectivo + newTarjeta + newQr + (Number(caja.otros_ingresos) || 0)
        const newCajaFinal = (Number(caja.caja_inicial) || 0) + newTotalIngresos - (Number(caja.gastos_dia) || 0)

        await supabase
          .from("caja_diaria")
          .update({
            ventas_efectivo: newEfectivo,
            ventas_tarjeta: newTarjeta,
            ventas_qr: newQr,
            total_ingresos: newTotalIngresos,
            caja_final: newCajaFinal,
          })
          .eq("id", caja.id)
      }

      // Show printable ticket immediately (inventory updates in background)
      const montoEfectivo = metodoPago === "efectivo" && montoNum > 0 ? montoNum : undefined
      setTicketData({
        orderId,
        cajero: cajero.trim(),
        items: [...carrito],
        total,
        metodoPago,
        fecha: hoy,
        hora,
        montoRecibido: montoEfectivo,
        cambio: montoEfectivo ? montoEfectivo - total : undefined,
      })
      setCarrito([])
      const newId = await generateOrderId()
      setOrderId(newId)

    } catch (err) {
      console.error(err)
      alert("Error al procesar la venta")
    } finally {
      setProcesando(false)
    }
  }

  async function guardarTicketImagen() {
    setGuardandoImg(true)
    try {
      const el = document.getElementById("ticket-print")
      if (!el) return

      // Temporalmente forzar el elemento a ser completamente visible
      const modal = document.getElementById('ticket-modal')
      const prevModalStyle = modal?.style.cssText || ''
      if (modal) {
        modal.style.maxHeight = 'none'
        modal.style.overflow = 'visible'
      }
      el.style.overflow = 'visible'
      el.style.height = 'auto'

      // Esperar un frame para que el browser re-renderice
      await new Promise(r => setTimeout(r, 100))

      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        scrollY: -window.scrollY,
        height: el.scrollHeight + 40,
        windowHeight: el.scrollHeight + 40,
      })

      // Restaurar estilos
      if (modal) modal.style.cssText = prevModalStyle
      el.style.overflow = ''
      el.style.height = ''

      const link = document.createElement("a")
      link.download = `venta-cajero-${ticketData?.orderId}-${ticketData?.fecha}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (e) {
      console.error(e)
    } finally {
      setGuardandoImg(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Cargando productos...</div>
  }

  if (cajaAbierta === false) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="bg-white border-2 border-dashed border-orange-300 rounded-2xl p-12 text-center space-y-4 max-w-md">
          <p className="text-5xl">🏧</p>
          <p className="text-xl font-bold text-gray-700">La caja no esta abierta</p>
          <p className="text-sm text-gray-500">Para empezar a vender, primero abre la caja del dia con el monto inicial (caja chica).</p>
          <a href="/caja"
            className="inline-block bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-green-700">
            Ir a Abrir Caja
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-2rem)]">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-auto flex-1">
          {productosFiltrados.map((producto) => (
            <button
              key={producto.id}
              onClick={() => agregarAlCarrito(producto)}
              className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-[var(--primary)] hover:shadow-md transition-all text-left flex items-center gap-3"
            >
              {producto.imagen_url ? (
                <img src={producto.imagen_url} alt={producto.nombre} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">🍔</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{producto.nombre}</p>
                <p className="text-xs text-gray-500">{producto.categoria}</p>
                <p className="text-base font-bold text-[var(--primary)]">
                  ${producto.precio_venta.toFixed(2)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart / Ticket */}
      <div className="w-80 bg-white rounded-lg shadow border flex flex-col">
        <div className="bg-gray-800 text-white p-3 rounded-t-lg">
          <h3 className="font-bold">Ticket de Venta</h3>
          <div className="flex justify-between text-xs text-gray-400">
            <span>{orderId}</span>
            <span>{new Date().toLocaleDateString("es-MX")}</span>
          </div>
        </div>

        <div className="p-3">
          {userRole === 'cajero' ? (
            <div className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-600 mb-2">
              Cajero: <strong>{cajero}</strong>
            </div>
          ) : (
            <input
              type="text"
              placeholder="Nombre del cajero..."
              value={cajero}
              onChange={(e) => setCajero(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm mb-2"
            />
          )}
        </div>

        <div className="flex-1 overflow-auto px-3 space-y-2">
          {carrito.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">
              Selecciona productos para vender
            </p>
          ) : (
            carrito.map((item) => (
              <div
                key={item.producto_id}
                className="flex items-center gap-2 border-b pb-2"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.nombre}</p>
                  <p className="text-xs text-gray-500">
                    ${item.precio_unitario.toFixed(2)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cambiarCantidad(item.producto_id, -1)}
                    className="w-6 h-6 bg-gray-200 rounded text-sm font-bold hover:bg-gray-300"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {item.cantidad}
                  </span>
                  <button
                    onClick={() => cambiarCantidad(item.producto_id, 1)}
                    className="w-6 h-6 bg-gray-200 rounded text-sm font-bold hover:bg-gray-300"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm font-bold w-16 text-right">
                  ${item.subtotal.toFixed(2)}
                </p>
                <button
                  onClick={() => quitarDelCarrito(item.producto_id)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  X
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-3 space-y-3">
          <div className="flex justify-between text-xl font-bold">
            <span>TOTAL</span>
            <span className="text-[var(--primary)]">${total.toFixed(2)}</span>
          </div>

          {carrito.length > 0 && userRole !== 'cajero' && (
            <div className="flex justify-between text-xs text-gray-500 border-t pt-1">
              <span>Costo: ${costoTotal.toFixed(2)}</span>
              <span className={utilidad >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                Utilidad: ${utilidad.toFixed(2)}
              </span>
            </div>
          )}

          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="efectivo">Efectivo</option>
            <option value="qr">QR / Transferencia</option>
          </select>

          {metodoPago === "efectivo" && carrito.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">Recibido:</label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    className="w-full border rounded px-3 pl-7 py-2 text-sm"
                    min="0"
                    step="0.50"
                  />
                </div>
              </div>
              {montoNum > 0 && (
                <div className={`flex justify-between text-sm font-bold px-1 ${cambio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>Cambio:</span>
                  <span>${cambio >= 0 ? cambio.toFixed(2) : `Faltan $${Math.abs(cambio).toFixed(2)}`}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              procesarVenta()
              setMontoRecibido("")
            }}
            disabled={carrito.length === 0 || procesando}
            className="w-full bg-[var(--primary)] text-white py-3 rounded-lg font-bold text-lg hover:bg-[var(--primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {procesando ? "Procesando..." : "Cobrar"}
          </button>

          {carrito.length > 0 && (
            <button
              onClick={() => setCarrito([])}
              className="w-full text-gray-500 text-sm hover:text-red-500"
            >
              Limpiar carrito
            </button>
          )}
        </div>

      </div>

      {/* Ticket Modal */}
      {ticketData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #ticket-print, #ticket-print * { visibility: visible !important; }
              #ticket-print {
                position: fixed !important;
                left: 0 !important; top: 0 !important;
                width: 80mm !important;
                padding: 6mm !important;
                font-size: 12px !important;
                line-height: 1.4 !important;
                box-sizing: border-box !important;
                overflow-wrap: break-word !important;
                overflow: visible !important;
              }
              #ticket-print span {
                overflow: visible !important;
                text-overflow: unset !important;
                white-space: normal !important;
              }
            }
            /* Fix para html2canvas - evita cortes al guardar imagen */
            #ticket-print {
              max-width: 100%;
              box-sizing: border-box;
              overflow-wrap: break-word;
              word-wrap: break-word;
            }
            #ticket-print * {
              max-width: 100%;
              box-sizing: border-box;
            }
          `}</style>
          <div id="ticket-modal" className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="bg-blue-800 text-white p-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm">Venta Cajero — Ticket generado</span>
                <p className="text-blue-300 text-xs">Pedido {ticketData?.orderId} · {ticketData?.cajero}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-white text-gray-800 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100"
                >
                  🖨️ Imprimir
                </button>
                <button
                  onClick={guardarTicketImagen}
                  disabled={guardandoImg}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-500 disabled:opacity-60"
                >
                  {guardandoImg ? "..." : "💾 Guardar PNG"}
                </button>
                <button
                  onClick={async () => {
                    setTicketData(null)
                    const newId = await generateOrderId()
                    setOrderId(newId)
                  }}
                  className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-500"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Ticket content — printable area */}
            <div id="ticket-print" className="p-6 font-mono text-sm leading-relaxed">
              {/* Header */}
              <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-3">
                <p className="text-xl font-black tracking-wider">CONTRY BURGER</p>
                <div className="inline-block bg-blue-700 text-white text-xs font-black px-3 py-0.5 rounded-full mt-1 mb-1 tracking-widest">
                  VENTA CAJERO
                </div>
                <p className="text-xs mt-1">{ticketData.fecha} — {ticketData.hora}</p>
                <p className="text-xs">Cajero: <strong>{ticketData.cajero}</strong></p>
              </div>

              {/* Ticket number */}
              <div className="text-center mb-3">
                <span className="bg-gray-800 text-white px-4 py-1 rounded text-base font-black tracking-widest">
                  Pedido #{ticketData.orderId}
                </span>
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex text-sm text-gray-500 mb-1">
                  <span className="flex-1">PRODUCTO</span>
                  <span className="w-8 text-center">CT</span>
                  <span className="w-16 text-right">P.U.</span>
                  <span className="w-18 text-right">TOTAL</span>
                </div>
                {ticketData.items.map((item, i) => (
                  <div key={i} className="flex text-sm py-1 leading-snug">
                    <span className="flex-1 break-words min-w-0">{item.nombre}</span>
                    <span className="w-8 text-center shrink-0">{item.cantidad}</span>
                    <span className="w-16 text-right shrink-0">${item.precio_unitario.toFixed(2)}</span>
                    <span className="w-18 text-right font-semibold shrink-0">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="space-y-1">
                <div className="flex justify-between font-black text-lg border-t-2 border-gray-800 pt-2">
                  <span>TOTAL</span>
                  <span>${ticketData.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Método de pago:</span>
                  <span className="font-semibold uppercase">{ticketData.metodoPago}</span>
                </div>
                {ticketData.montoRecibido != null && (
                  <>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Recibido:</span>
                      <span className="font-semibold">${ticketData.montoRecibido.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-green-700">
                      <span>Cambio:</span>
                      <span>${(ticketData.cambio ?? 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-400 text-xs text-gray-500">
                <p>Presente este ticket para</p>
                <p>retirar su pedido</p>
                <p className="mt-1 font-semibold">¡Gracias por su preferencia!</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
