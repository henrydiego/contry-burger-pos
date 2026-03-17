"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Producto, Receta, Inventario } from "@/lib/types"

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

export default function POSPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [inventario, setInventario] = useState<Inventario[]>([])
  const [carrito, setCarrito] = useState<CartItem[]>([])
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [cajero, setCajero] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [alertasStock, setAlertasStock] = useState<StockAlert[]>([])
  const [ventaExitosa, setVentaExitosa] = useState("")

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
  }, [])

  async function loadData() {
    const [prodRes, recRes, invRes] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true).order("categoria"),
      supabase.from("recetas").select("*"),
      supabase.from("inventario").select("*"),
    ])
    setProductos(prodRes.data || [])
    setRecetas(recRes.data || [])
    setInventario(invRes.data || [])
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

      // 2. Deduct inventory: update consumo_total AND stock_actual
      const alertasNuevas: StockAlert[] = []
      for (const item of carrito) {
        const recetasProducto = recetas.filter((r) => r.producto_id === item.producto_id)
        for (const rec of recetasProducto) {
          const cantidadDescontar = rec.cantidad * item.cantidad
          const { data: invData } = await supabase
            .from("inventario")
            .select("consumo_total, stock_actual, stock_minimo, nombre, unidad")
            .eq("ingrediente_id", rec.ingrediente_id)
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
              .eq("ingrediente_id", rec.ingrediente_id)

            // Check stock alert
            if (nuevoStock <= (Number(invData.stock_minimo) || 0)) {
              alertasNuevas.push({
                ingrediente: invData.nombre,
                stock_actual: Math.max(0, nuevoStock),
                stock_minimo: Number(invData.stock_minimo) || 0,
                unidad: invData.unidad,
              })
            }
          }
        }
      }

      // 3. Register in caja_diaria automatically
      const ventaEfectivo = metodoPago === "efectivo" ? total : 0
      const ventaTarjeta = metodoPago === "tarjeta" ? total : 0
      const ventaQr = metodoPago === "qr" ? total : 0

      // Check if caja_diaria exists for today
      const { data: cajaExistente } = await supabase
        .from("caja_diaria")
        .select("*")
        .eq("fecha", hoy)
        .limit(1)

      if (cajaExistente && cajaExistente.length > 0) {
        // Update existing caja_diaria
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
      } else {
        // Create new caja_diaria for today
        const totalIngresos = ventaEfectivo + ventaTarjeta + ventaQr
        await supabase.from("caja_diaria").insert({
          fecha: hoy,
          turno: "Completo",
          caja_inicial: 0,
          ventas_efectivo: ventaEfectivo,
          ventas_tarjeta: ventaTarjeta,
          ventas_qr: ventaQr,
          otros_ingresos: 0,
          total_ingresos: totalIngresos,
          gastos_dia: 0,
          caja_final: totalIngresos,
          diferencia: 0,
          estado: "Abierta",
        })
      }

      // Show alerts if any
      if (alertasNuevas.length > 0) {
        setAlertasStock(alertasNuevas)
      }

      setVentaExitosa(`${orderId} — $${total.toFixed(2)} | Costo: $${costoTotal.toFixed(2)} | Utilidad: $${utilidad.toFixed(2)}`)
      setCarrito([])
      const newId = await generateOrderId()
      setOrderId(newId)

      // Refresh inventory data
      const { data: invRefresh } = await supabase.from("inventario").select("*")
      if (invRefresh) setInventario(invRefresh)

    } catch (err) {
      console.error(err)
      alert("Error al procesar la venta")
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Cargando productos...</div>
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
              className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-[var(--primary)] hover:shadow-md transition-all text-left flex flex-col"
            >
              <div className="text-2xl mb-2">🍔</div>
              <p className="font-semibold text-sm truncate">{producto.nombre}</p>
              <p className="text-xs text-gray-500">{producto.categoria}</p>
              <p className="text-lg font-bold text-[var(--primary)] mt-auto">
                ${producto.precio_venta.toFixed(2)}
              </p>
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
          <input
            type="text"
            placeholder="Nombre del cajero..."
            value={cajero}
            onChange={(e) => setCajero(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm mb-2"
          />
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

          {carrito.length > 0 && (
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
            <option value="tarjeta">Tarjeta</option>
            <option value="qr">QR / Transferencia</option>
          </select>

          <button
            onClick={procesarVenta}
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

        {/* Venta exitosa notification */}
        {ventaExitosa && (
          <div className="p-3 bg-green-50 border-t border-green-200">
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-700 font-medium">Venta registrada: {ventaExitosa}</p>
              <button onClick={() => setVentaExitosa("")} className="text-green-500 text-xs hover:text-green-700">X</button>
            </div>
          </div>
        )}
      </div>

      {/* Stock Alerts Modal */}
      {alertasStock.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-3">Alerta de Inventario Bajo</h3>
            <div className="space-y-2 mb-4">
              {alertasStock.map((a, i) => (
                <div key={i} className="flex justify-between items-center bg-red-50 p-2 rounded text-sm">
                  <span className="font-medium">{a.ingrediente}</span>
                  <span className="text-red-600">
                    {a.stock_actual.toFixed(2)} / {a.stock_minimo.toFixed(2)} {a.unidad}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-3">Estos ingredientes estan por debajo del stock minimo. Considera hacer una compra.</p>
            <button
              onClick={() => setAlertasStock([])}
              className="w-full bg-red-600 text-white py-2 rounded font-semibold hover:bg-red-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
