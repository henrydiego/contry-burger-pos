"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Producto, VentaItem } from "@/lib/types"

export default function POSPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<VentaItem[]>([])
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    loadProductos()
  }, [])

  async function loadProductos() {
    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .order("categoria")
    setProductos(data || [])
    setLoading(false)
  }

  const categorias = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoria)))]

  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = categoriaFiltro === "Todos" || p.categoria === categoriaFiltro
    return matchBusqueda && matchCategoria
  })

  function agregarAlCarrito(producto: Producto) {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto_id === producto.id)
      if (existe) {
        return prev.map((item) =>
          item.producto_id === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: (item.cantidad + 1) * item.precio_unitario,
              }
            : item
        )
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          subtotal: producto.precio_venta,
        },
      ]
    })
  }

  function cambiarCantidad(productoId: number, delta: number) {
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
          }
        })
        .filter(Boolean) as VentaItem[]
    )
  }

  function quitarDelCarrito(productoId: number) {
    setCarrito((prev) => prev.filter((item) => item.producto_id !== productoId))
  }

  const total = carrito.reduce((s, item) => s + item.subtotal, 0)

  async function procesarVenta() {
    if (carrito.length === 0) return
    setProcesando(true)
    try {
      const venta = {
        items: carrito,
        total,
        metodo_pago: metodoPago,
        fecha: new Date().toISOString().split("T")[0],
      }
      const { error } = await supabase.from("ventas").insert(venta)
      if (error) throw error

      // Descontar inventario
      for (const item of carrito) {
        try {
          await supabase.rpc("descontar_inventario", {
            p_producto_id: item.producto_id,
            p_cantidad: item.cantidad,
          })
        } catch {
          // RPC may not exist yet, that's ok
        }
      }

      alert(`Venta registrada: $${total.toFixed(2)}`)
      setCarrito([])
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
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString("es-MX")}</p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
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
                    −
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
                  ✕
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

          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
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
      </div>
    </div>
  )
}
