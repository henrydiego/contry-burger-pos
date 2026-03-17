"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface Producto {
  id: string
  nombre: string
  categoria: string
  precio_venta: number
  activo: boolean
}

interface CartItem {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

type Step = "menu" | "datos" | "confirmacion"

const CATEGORIA_ICON: Record<string, string> = {
  Hamburguesas: "🍔",
  "Hot Dogs": "🌭",
  Bebidas: "🥤",
  Combos: "🎁",
  Acompanantes: "🍟",
}

export default function MenuPublico() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<CartItem[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>("menu")
  const [enviando, setEnviando] = useState(false)
  const [qrUrl, setQrUrl] = useState("")
  const [instruccionesQr, setInstruccionesQr] = useState("Escanea el QR con tu app de Yape o BCP y envía el monto exacto.")
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  const [cliente, setCliente] = useState({
    nombre: "",
    telefono: "",
    notas: "",
    metodo_pago: "efectivo",
    direccion: "",
    latitud: null as number | null,
    longitud: null as number | null,
  })

  useEffect(() => {
    loadAll()
    checkGoogleUser()
  }, [])

  async function loadAll() {
    const [{ data: prods }, { data: config }] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true).order("categoria"),
      supabase.from("configuracion").select("qr_pago_url, instrucciones_pago").eq("id", 1).single(),
    ])
    setProductos(prods || [])
    if (config?.qr_pago_url) setQrUrl(config.qr_pago_url)
    if (config?.instrucciones_pago) setInstruccionesQr(config.instrucciones_pago)
    setLoading(false)
  }

  async function checkGoogleUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const name = user.user_metadata?.full_name || user.user_metadata?.name || ""
      setGoogleUser({ name, email: user.email || "" })
      setCliente((prev) => ({ ...prev, nombre: name }))
    }
  }

  async function loginConGoogle() {
    setLoginLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/menu` },
    })
  }

  async function logoutCliente() {
    await supabase.auth.signOut()
    setGoogleUser(null)
    setCliente({ nombre: "", telefono: "", notas: "", metodo_pago: "efectivo", direccion: "", latitud: null, longitud: null })
  }

  function obtenerUbicacion() {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta GPS")
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCliente((prev) => ({
          ...prev,
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        }))
        setGpsLoading(false)
      },
      (err) => {
        console.error(err)
        alert("No se pudo obtener la ubicación. Asegúrate de dar permiso al GPS.")
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function limpiarUbicacion() {
    setCliente((prev) => ({ ...prev, latitud: null, longitud: null }))
  }

  const categorias = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoria)))]
  const productosFiltrados = categoriaFiltro === "Todos" ? productos : productos.filter((p) => p.categoria === categoriaFiltro)

  function agregarAlCarrito(producto: Producto) {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto_id === producto.id)
      if (existe) {
        return prev.map((item) =>
          item.producto_id === producto.id
            ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario }
            : item
        )
      }
      return [...prev, { producto_id: producto.id, nombre: producto.nombre, cantidad: 1, precio_unitario: producto.precio_venta, subtotal: producto.precio_venta }]
    })
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.producto_id !== productoId) return item
          const nueva = item.cantidad + delta
          if (nueva <= 0) return null as unknown as CartItem
          return { ...item, cantidad: nueva, subtotal: nueva * item.precio_unitario }
        })
        .filter(Boolean)
    )
  }

  function quitarDelCarrito(productoId: string) {
    setCarrito((prev) => prev.filter((item) => item.producto_id !== productoId))
  }

  const total = carrito.reduce((s, item) => s + item.subtotal, 0)

  async function enviarPedido() {
    if (!cliente.nombre.trim() || !cliente.telefono.trim()) {
      alert("Por favor ingresa tu nombre y teléfono")
      return
    }
    setEnviando(true)
    try {
      const { data: lastPedido } = await supabase.from("pedidos").select("order_id").order("id", { ascending: false }).limit(1)
      let newOrderId = "PED001"
      if (lastPedido && lastPedido.length > 0) {
        const num = parseInt(String(lastPedido[0].order_id || "PED000").replace("PED", "")) || 0
        newOrderId = `PED${String(num + 1).padStart(3, "0")}`
      }

      const hora = new Date().toTimeString().split(" ")[0]
      const hoy = new Date().toISOString().split("T")[0]
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from("pedidos").insert({
        order_id: newOrderId,
        cliente_nombre: cliente.nombre.trim(),
        cliente_telefono: cliente.telefono.trim(),
        cliente_email: user?.email || null,
        user_id: user?.id || null,
        items: carrito,
        total,
        estado: "pendiente",
        metodo_pago: cliente.metodo_pago,
        notas: cliente.notas.trim(),
        fecha: hoy,
        hora,
        pago_verificado: false,
        latitud: cliente.latitud,
        longitud: cliente.longitud,
        direccion: cliente.direccion.trim() || null,
      })

      if (error) throw error
      router.push(`/menu/seguimiento?order=${newOrderId}`)
    } catch (err) {
      console.error(err)
      alert("Error al enviar el pedido. Intenta de nuevo.")
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-400 text-lg">Cargando menú...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-3 py-3 flex items-center justify-between gap-2">
          <div className="shrink-0">
            <h1 className="text-lg font-bold text-red-500 leading-tight">Contry Burger</h1>
            <p className="text-xs text-gray-400">Pedidos Online</p>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {/* Google login */}
            {googleUser ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-300 truncate max-w-[100px] hidden sm:block">{googleUser.name}</span>
                <button onClick={logoutCliente} className="text-xs text-gray-400 hover:text-white shrink-0">Salir</button>
              </div>
            ) : (
              <button
                onClick={loginConGoogle}
                disabled={loginLoading}
                className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-60 shrink-0"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.8 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.4-4z"/>
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"/>
                  <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.9 13.4-5l-6.2-5.3C29.3 37 26.8 38 24 38c-5.2 0-9.6-3.2-11.3-7.8l-6.5 5C9.6 41 16.3 45.5 24 45.5z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.4l6.2 5.3c3.6-3.3 5.8-8.3 5.8-14.2 0-1.4-.1-2.7-.4-4z"/>
                </svg>
                <span className="hidden xs:inline">Google</span>
              </button>
            )}

            {carrito.length > 0 && step === "menu" && (
              <button
                onClick={() => setStep("datos")}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shrink-0 whitespace-nowrap"
              >
                🛒 {carrito.length} — ${total.toFixed(2)}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4">

        {/* STEP: Menú */}
        {step === "menu" && (
          <>
            {/* Filtros categoría */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                    categoriaFiltro === cat ? "bg-red-600 text-white" : "bg-white text-gray-700 border hover:bg-gray-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid productos */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-28">
              {productosFiltrados.map((producto) => {
                const enCarrito = carrito.find((c) => c.producto_id === producto.id)
                return (
                  <div key={producto.id} className="bg-white rounded-xl shadow-sm border p-3 flex flex-col">
                    <div className="text-3xl mb-1 text-center">{CATEGORIA_ICON[producto.categoria] ?? "🍽️"}</div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{producto.nombre}</h3>
                    <p className="text-xs text-gray-400 mb-1">{producto.categoria}</p>
                    <p className="text-lg font-bold text-red-600 mb-2">${producto.precio_venta.toFixed(2)}</p>

                    {enCarrito ? (
                      <div className="flex items-center justify-between mt-auto gap-1">
                        <button onClick={() => cambiarCantidad(producto.id, -1)} className="w-8 h-8 bg-gray-200 rounded-full font-bold text-lg hover:bg-gray-300 flex items-center justify-center">-</button>
                        <span className="font-bold w-6 text-center">{enCarrito.cantidad}</span>
                        <button onClick={() => cambiarCantidad(producto.id, 1)} className="w-8 h-8 bg-red-600 text-white rounded-full font-bold text-lg hover:bg-red-700 flex items-center justify-center">+</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => agregarAlCarrito(producto)}
                        className="mt-auto bg-red-600 text-white py-1.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Carrito flotante */}
            {carrito.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-3 z-30">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-600">{carrito.reduce((s, i) => s + i.cantidad, 0)} item(s)</p>
                    <p className="text-xl font-black text-red-600">${total.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setStep("datos")} className="bg-red-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-red-700 text-sm">
                    Hacer Pedido →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP: Datos */}
        {step === "datos" && (
          <div className="max-w-lg mx-auto">
            <button onClick={() => setStep("menu")} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
              ← Volver al menú
            </button>

            <div className="bg-white rounded-xl shadow border p-4 space-y-3">
              <h2 className="text-xl font-bold">Tu Pedido</h2>

              {/* Resumen carrito */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 border">
                {carrito.map((item) => (
                  <div key={item.producto_id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.cantidad}x {item.nombre}</span>
                    <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-base pt-1.5 border-t mt-1">
                  <span>Total</span>
                  <span className="text-red-600">${total.toFixed(2)}</span>
                </div>
              </div>

              <h3 className="font-semibold text-gray-800">Tus datos</h3>

              <input
                type="text"
                placeholder="Tu nombre *"
                value={cliente.nombre}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <input
                type="tel"
                placeholder="Tu teléfono *"
                value={cliente.telefono}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <textarea
                placeholder="Notas especiales (sin cebolla, extra salsa...)"
                value={cliente.notas}
                onChange={(e) => setCliente({ ...cliente, notas: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                rows={2}
              />
              <select
                value={cliente.metodo_pago}
                onChange={(e) => setCliente({ ...cliente, metodo_pago: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
              >
                <option value="efectivo">Pago en Efectivo</option>
                <option value="tarjeta">Pago con Tarjeta</option>
                <option value="qr">Pago QR / Yape / BCP</option>
              </select>

              {/* Sección ubicación */}
              <div className="border rounded-xl p-3 space-y-2 bg-blue-50 border-blue-200">
                <p className="text-sm font-semibold text-blue-800">📍 Ubicación para entrega (opcional)</p>
                <p className="text-xs text-blue-600">Activa el GPS para que podamos llevarte el pedido.</p>

                {cliente.latitud ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 text-sm font-semibold">✅ Ubicación capturada</span>
                      <button onClick={limpiarUbicacion} className="text-xs text-red-400 hover:text-red-600 underline">quitar</button>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline"
                    >
                      Ver en Google Maps
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={obtenerUbicacion}
                    disabled={gpsLoading}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {gpsLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Obteniendo ubicación...
                      </>
                    ) : (
                      <>📍 Compartir mi ubicación GPS</>
                    )}
                  </button>
                )}

                <input
                  type="text"
                  placeholder="Dirección o referencia (ej: Av. Los Olivos 123, frente al parque)"
                  value={cliente.direccion}
                  onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <button
                onClick={() => setStep("confirmacion")}
                disabled={!cliente.nombre.trim() || !cliente.telefono.trim()}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-base hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* STEP: Confirmación */}
        {step === "confirmacion" && (
          <div className="max-w-lg mx-auto space-y-3">
            <button onClick={() => setStep("datos")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              ← Editar datos
            </button>

            <div className="bg-white rounded-xl shadow border p-4 space-y-3">
              <h2 className="text-xl font-bold">Confirmar Pedido</h2>

              {/* Resumen cliente */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm border">
                <p><span className="font-medium text-gray-600">Nombre:</span> {cliente.nombre}</p>
                <p><span className="font-medium text-gray-600">Teléfono:</span> {cliente.telefono}</p>
                {cliente.notas && <p><span className="font-medium text-gray-600">Notas:</span> {cliente.notas}</p>}
                <p><span className="font-medium text-gray-600">Pago:</span> {cliente.metodo_pago === "qr" ? "QR / Yape / BCP" : cliente.metodo_pago}</p>
                {(cliente.latitud || cliente.direccion) && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-gray-600">Entrega:</span>
                    {cliente.latitud && (
                      <a
                        href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline text-xs"
                      >
                        📍 Ver ubicación GPS
                      </a>
                    )}
                    {cliente.direccion && <span className="text-gray-700">— {cliente.direccion}</span>}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1">
                {carrito.map((item) => (
                  <div key={item.producto_id} className="flex justify-between text-sm">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-black text-xl pt-2 border-t">
                  <span>TOTAL</span>
                  <span className="text-red-600">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* QR de pago */}
              {cliente.metodo_pago === "qr" && qrUrl && (
                <div className="border-2 border-dashed border-yellow-400 rounded-xl p-4 bg-yellow-50 space-y-3">
                  <p className="font-semibold text-yellow-800 text-sm">Escanea para pagar antes de confirmar</p>
                  <div className="flex flex-col items-center gap-2">
                    <img src={qrUrl} alt="QR de pago" className="w-44 h-44 object-contain rounded-lg border bg-white" />
                    <a href={qrUrl} download="qr-contryburguer.png" className="text-sm text-blue-600 underline">
                      Descargar QR
                    </a>
                  </div>
                  <p className="text-xs text-yellow-700">{instruccionesQr}</p>
                  <p className="text-sm font-bold text-yellow-900">Monto a pagar: ${total.toFixed(2)}</p>
                </div>
              )}

              {cliente.metodo_pago === "qr" && !qrUrl && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-700">
                  Confirma el pedido y sigue las instrucciones de pago que te indicaremos.
                </div>
              )}

              <button
                onClick={enviarPedido}
                disabled={enviando}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-base hover:bg-red-700 disabled:opacity-50"
              >
                {enviando ? "Enviando..." : cliente.metodo_pago === "qr" ? "✅ Ya pagué, confirmar pedido" : "Confirmar Pedido"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
