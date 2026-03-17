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
  imagen_url: string | null
  agotado: boolean
}

interface CartItem {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Config {
  qr_pago_url: string
  instrucciones_pago: string
  hora_apertura: string
  hora_cierre: string
  abierto: boolean
  tiempo_estimado: string
  costo_envio: number
  pedido_minimo: number
  mensaje_bienvenida: string
}

type Step = "menu" | "datos" | "confirmacion"

const CATEGORIA_ICON: Record<string, string> = {
  Hamburguesas: "🍔", "Hot Dogs": "🌭", Bebidas: "🥤", Combos: "🎁", Acompanantes: "🍟",
}

function estaAbierto(cfg: Config): boolean {
  if (!cfg.abierto) return false
  const now = new Date()
  const [hA, mA] = cfg.hora_apertura.split(":").map(Number)
  const [hC, mC] = cfg.hora_cierre.split(":").map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  return mins >= hA * 60 + mA && mins < hC * 60 + mC
}

export default function MenuPublico() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<CartItem[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>("menu")
  const [enviando, setEnviando] = useState(false)
  const [config, setConfig] = useState<Config>({
    qr_pago_url: "", instrucciones_pago: "", hora_apertura: "00:00",
    hora_cierre: "23:59", abierto: true, tiempo_estimado: "30-45 min",
    costo_envio: 0, pedido_minimo: 0, mensaje_bienvenida: "",
  })
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [cuponInput, setCuponInput] = useState("")
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; descuento: number } | null>(null)
  const [cuponError, setCuponError] = useState("")
  const [validandoCupon, setValidandoCupon] = useState(false)

  const [cliente, setCliente] = useState({
    nombre: "", telefono: "", notas: "", metodo_pago: "efectivo",
    direccion: "", latitud: null as number | null, longitud: null as number | null,
  })

  useEffect(() => {
    loadAll()
    checkGoogleUser()
    // Repetir pedido desde historial
    const savedCart = sessionStorage.getItem("repeat_order")
    if (savedCart) {
      try { setCarrito(JSON.parse(savedCart)) } catch { /* ignore */ }
      sessionStorage.removeItem("repeat_order")
    }
  }, [])

  async function loadAll() {
    const [{ data: prods }, { data: cfg }] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true).order("categoria"),
      supabase.from("configuracion").select("*").eq("id", 1).single(),
    ])
    setProductos(prods || [])
    if (cfg) setConfig({ ...config, ...cfg })
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
    if (!navigator.geolocation) { alert("Tu navegador no soporta GPS"); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCliente((prev) => ({ ...prev, latitud: pos.coords.latitude, longitud: pos.coords.longitude }))
        setGpsLoading(false)
      },
      () => { alert("No se pudo obtener la ubicación. Da permiso al GPS."); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function validarCupon() {
    if (!cuponInput.trim()) return
    setValidandoCupon(true)
    setCuponError("")
    setCuponAplicado(null)
    const res = await fetch("/api/validar-cupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: cuponInput, total: subtotalProductos }),
    })
    const data = await res.json()
    setValidandoCupon(false)
    if (data.ok) {
      setCuponAplicado({ codigo: data.cupon.codigo, descuento: data.descuento })
    } else {
      setCuponError(data.error || "Cupón inválido")
    }
  }

  const categorias = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoria)))]
  const productosFiltrados = categoriaFiltro === "Todos" ? productos : productos.filter((p) => p.categoria === categoriaFiltro)

  function agregarAlCarrito(producto: Producto) {
    if (producto.agotado) return
    setCarrito((prev) => {
      const existe = prev.find((item) => item.producto_id === producto.id)
      if (existe) return prev.map((item) => item.producto_id === producto.id
        ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario }
        : item
      )
      return [...prev, { producto_id: producto.id, nombre: producto.nombre, cantidad: 1, precio_unitario: producto.precio_venta, subtotal: producto.precio_venta }]
    })
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.producto_id !== productoId) return item
        const n = item.cantidad + delta
        if (n <= 0) return null as unknown as CartItem
        return { ...item, cantidad: n, subtotal: n * item.precio_unitario }
      }).filter(Boolean)
    )
  }

  const subtotalProductos = carrito.reduce((s, i) => s + i.subtotal, 0)
  const costoEnvio = cliente.latitud ? config.costo_envio : 0
  const descuento = cuponAplicado?.descuento ?? 0
  const total = subtotalProductos + costoEnvio - descuento

  async function enviarPedido() {
    if (!cliente.nombre.trim() || !cliente.telefono.trim()) {
      alert("Por favor ingresa tu nombre y teléfono"); return
    }
    if (config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo) {
      alert(`El pedido mínimo es $${config.pedido_minimo.toFixed(2)}`); return
    }
    setEnviando(true)
    try {
      const { data: last } = await supabase.from("pedidos").select("order_id").order("id", { ascending: false }).limit(1)
      let newOrderId = "PED001"
      if (last && last.length > 0) {
        const num = parseInt(String(last[0].order_id || "PED000").replace("PED", "")) || 0
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
        fecha: hoy, hora,
        pago_verificado: false,
        latitud: cliente.latitud,
        longitud: cliente.longitud,
        direccion: cliente.direccion.trim() || null,
        descuento,
        cupon_codigo: cuponAplicado?.codigo || null,
        costo_envio_aplicado: costoEnvio,
      })
      if (error) throw error

      // Incrementar uso del cupón
      if (cuponAplicado) {
        await supabase.rpc('incrementar_uso_cupon', { p_codigo: cuponAplicado.codigo }).maybeSingle()
      }

      // Notificación WhatsApp (no bloqueante)
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: newOrderId, cliente_nombre: cliente.nombre, total, metodo_pago: cliente.metodo_pago, items: carrito, latitud: cliente.latitud, longitud: cliente.longitud, direccion: cliente.direccion }),
      }).catch(() => {})

      router.push(`/menu/seguimiento?order=${newOrderId}`)
    } catch (err) {
      console.error(err)
      alert("Error al enviar el pedido. Intenta de nuevo.")
      setEnviando(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-400">Cargando menú...</p></div>

  // Tienda cerrada
  if (!estaAbierto(config)) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-7xl mb-4">🔴</div>
        <h1 className="text-3xl font-black text-white mb-2">Estamos cerrados</h1>
        <p className="text-gray-400 text-lg mb-1">Contry Burger</p>
        <p className="text-gray-500">Horario: {config.hora_apertura} - {config.hora_cierre}</p>
        {config.mensaje_bienvenida && <p className="text-gray-400 mt-4 max-w-sm">{config.mensaje_bienvenida}</p>}
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
            <p className="text-xs text-gray-400">⏱ {config.tiempo_estimado}</p>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {googleUser ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-300 truncate max-w-[90px] hidden sm:block">{googleUser.name}</span>
                <button onClick={logoutCliente} className="text-xs text-gray-400 hover:text-white shrink-0">Salir</button>
              </div>
            ) : (
              <button onClick={loginConGoogle} disabled={loginLoading}
                className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded-full hover:bg-gray-100 disabled:opacity-60 shrink-0">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.8 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.4-4z"/>
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"/>
                  <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.9 13.4-5l-6.2-5.3C29.3 37 26.8 38 24 38c-5.2 0-9.6-3.2-11.3-7.8l-6.5 5C9.6 41 16.3 45.5 24 45.5z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.4l6.2 5.3c3.6-3.3 5.8-8.3 5.8-14.2 0-1.4-.1-2.7-.4-4z"/>
                </svg>
                <span>Google</span>
              </button>
            )}
            {googleUser && (
              <a href="/menu/mis-pedidos" className="text-xs text-gray-400 hover:text-white shrink-0 hidden sm:block">Mis pedidos</a>
            )}
            {carrito.length > 0 && step === "menu" && (
              <button onClick={() => setStep("datos")} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold shrink-0">
                🛒 {carrito.length} · ${subtotalProductos.toFixed(2)}
              </button>
            )}
          </div>
        </div>
        {config.mensaje_bienvenida && step === "menu" && (
          <div className="bg-red-900/40 px-4 py-1.5 text-xs text-red-200 text-center">{config.mensaje_bienvenida}</div>
        )}
        {config.pedido_minimo > 0 && step === "menu" && (
          <div className="bg-yellow-900/40 px-4 py-1 text-xs text-yellow-300 text-center">Pedido mínimo: ${config.pedido_minimo.toFixed(2)}</div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4">

        {/* STEP: Menú */}
        {step === "menu" && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {categorias.map((cat) => (
                <button key={cat} onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${categoriaFiltro === cat ? "bg-red-600 text-white" : "bg-white text-gray-700 border hover:bg-gray-100"}`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-28">
              {productosFiltrados.map((producto) => {
                const enCarrito = carrito.find((c) => c.producto_id === producto.id)
                return (
                  <div key={producto.id} className={`bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden ${producto.agotado ? "opacity-60" : ""}`}>
                    {/* Imagen o emoji */}
                    <div className="relative">
                      {producto.imagen_url ? (
                        <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-28 sm:h-32 object-cover" />
                      ) : (
                        <div className="w-full h-20 sm:h-24 bg-gray-100 flex items-center justify-center text-4xl">
                          {CATEGORIA_ICON[producto.categoria] ?? "🍽️"}
                        </div>
                      )}
                      {producto.agotado && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">Agotado</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col flex-1">
                      <h3 className="font-semibold text-xs sm:text-sm leading-tight line-clamp-2 mb-0.5">{producto.nombre}</h3>
                      <p className="text-xs text-gray-400 mb-1.5">{producto.categoria}</p>
                      <p className="text-base sm:text-lg font-black text-red-600 mb-2">${producto.precio_venta.toFixed(2)}</p>
                      {producto.agotado ? (
                        <div className="mt-auto bg-gray-100 text-gray-400 text-xs text-center py-1.5 rounded-lg font-medium">Agotado hoy</div>
                      ) : enCarrito ? (
                        <div className="flex items-center justify-between mt-auto">
                          <button onClick={() => cambiarCantidad(producto.id, -1)} className="w-8 h-8 bg-gray-200 rounded-full font-bold text-lg hover:bg-gray-300 flex items-center justify-center">-</button>
                          <span className="font-bold text-sm w-6 text-center">{enCarrito.cantidad}</span>
                          <button onClick={() => cambiarCantidad(producto.id, 1)} className="w-8 h-8 bg-red-600 text-white rounded-full font-bold text-lg hover:bg-red-700 flex items-center justify-center">+</button>
                        </div>
                      ) : (
                        <button onClick={() => agregarAlCarrito(producto)} className="mt-auto bg-red-600 text-white py-1.5 rounded-lg text-xs sm:text-sm font-semibold hover:bg-red-700">
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {carrito.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-3 z-30">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">{carrito.reduce((s, i) => s + i.cantidad, 0)} item(s)</p>
                    <p className="text-xl font-black text-red-600">${subtotalProductos.toFixed(2)}</p>
                  </div>
                  <button onClick={() => setStep("datos")} className="bg-red-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-red-700">
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
            <button onClick={() => setStep("menu")} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">← Volver al menú</button>
            <div className="bg-white rounded-xl shadow border p-4 space-y-3">
              <h2 className="text-xl font-bold">Tu Pedido</h2>

              {/* Resumen */}
              <div className="bg-gray-50 rounded-lg p-3 border space-y-1.5 text-sm">
                {carrito.map((item) => (
                  <div key={item.producto_id} className="flex justify-between">
                    <span className="text-gray-700">{item.cantidad}x {item.nombre}</span>
                    <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-1.5 mt-1 space-y-0.5">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span><span>${subtotalProductos.toFixed(2)}</span>
                  </div>
                  {costoEnvio > 0 && <div className="flex justify-between text-gray-500"><span>Envío</span><span>+${costoEnvio.toFixed(2)}</span></div>}
                  {descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-${descuento.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="text-red-600">${total.toFixed(2)}</span></div>
                </div>
              </div>

              <h3 className="font-semibold text-gray-800">Tus datos</h3>
              <input type="text" placeholder="Tu nombre *" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              <input type="tel" placeholder="Tu teléfono *" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              <textarea placeholder="Notas (sin cebolla, extra salsa...)" value={cliente.notas} onChange={(e) => setCliente({ ...cliente, notas: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" rows={2} />
              <select value={cliente.metodo_pago} onChange={(e) => setCliente({ ...cliente, metodo_pago: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400">
                <option value="efectivo">Pago en Efectivo</option>
                <option value="tarjeta">Pago con Tarjeta</option>
                <option value="qr">Pago QR / Yape / BCP</option>
              </select>

              {/* Ubicación */}
              <div className="border rounded-xl p-3 space-y-2 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-800">📍 Ubicación para delivery</p>
                  {config.costo_envio > 0 && <span className="text-xs text-blue-600">+${config.costo_envio.toFixed(2)} envío</span>}
                </div>
                {cliente.latitud ? (
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-sm font-semibold">✅ Ubicación capturada</span>
                    <a href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Ver mapa</a>
                    <button onClick={() => setCliente((c) => ({ ...c, latitud: null, longitud: null }))} className="text-xs text-red-400 underline">quitar</button>
                  </div>
                ) : (
                  <button onClick={obtenerUbicacion} disabled={gpsLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                    {gpsLoading ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Obteniendo...</> : "📍 Compartir ubicación GPS"}
                  </button>
                )}
                <input type="text" placeholder="Dirección o referencia (opcional)" value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} className="w-full border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              {/* Cupón */}
              <div className="border rounded-xl p-3 space-y-2 bg-purple-50 border-purple-200">
                <p className="text-sm font-semibold text-purple-800">🎫 Cupón de descuento</p>
                {cuponAplicado ? (
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 text-sm font-bold">✅ {cuponAplicado.codigo} — -${cuponAplicado.descuento.toFixed(2)}</span>
                    <button onClick={() => { setCuponAplicado(null); setCuponInput("") }} className="text-xs text-red-400 underline">quitar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="Código de cupón" value={cuponInput} onChange={(e) => { setCuponInput(e.target.value.toUpperCase()); setCuponError("") }} className="flex-1 border border-purple-200 bg-white rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    <button onClick={validarCupon} disabled={validandoCupon || !cuponInput.trim()} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 shrink-0">
                      {validandoCupon ? "..." : "Aplicar"}
                    </button>
                  </div>
                )}
                {cuponError && <p className="text-red-500 text-xs">{cuponError}</p>}
              </div>

              <button onClick={() => setStep("confirmacion")} disabled={!cliente.nombre.trim() || !cliente.telefono.trim()} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* STEP: Confirmación */}
        {step === "confirmacion" && (
          <div className="max-w-lg mx-auto space-y-3">
            <button onClick={() => setStep("datos")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Editar datos</button>
            <div className="bg-white rounded-xl shadow border p-4 space-y-3">
              <h2 className="text-xl font-bold">Confirmar Pedido</h2>

              <div className="bg-gray-50 rounded-lg p-3 border text-sm space-y-1">
                <p><span className="font-medium text-gray-600">Nombre:</span> {cliente.nombre}</p>
                <p><span className="font-medium text-gray-600">Teléfono:</span> {cliente.telefono}</p>
                {cliente.notas && <p><span className="font-medium text-gray-600">Notas:</span> {cliente.notas}</p>}
                <p><span className="font-medium text-gray-600">Pago:</span> {cliente.metodo_pago === "qr" ? "QR / Yape / BCP" : cliente.metodo_pago}</p>
                {(cliente.latitud || cliente.direccion) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-600">Entrega:</span>
                    {cliente.latitud && <a href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">📍 GPS</a>}
                    {cliente.direccion && <span>{cliente.direccion}</span>}
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm">
                {carrito.map((item) => (
                  <div key={item.producto_id} className="flex justify-between"><span>{item.cantidad}x {item.nombre}</span><span>${item.subtotal.toFixed(2)}</span></div>
                ))}
                <div className="border-t pt-1.5 mt-1 space-y-0.5">
                  {costoEnvio > 0 && <div className="flex justify-between text-gray-500"><span>Envío</span><span>+${costoEnvio.toFixed(2)}</span></div>}
                  {descuento > 0 && <div className="flex justify-between text-green-600"><span>Descuento ({cuponAplicado?.codigo})</span><span>-${descuento.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-black text-xl pt-1 border-t"><span>TOTAL</span><span className="text-red-600">${total.toFixed(2)}</span></div>
                </div>
              </div>

              {/* QR pago */}
              {cliente.metodo_pago === "qr" && config.qr_pago_url && (
                <div className="border-2 border-dashed border-yellow-400 rounded-xl p-4 bg-yellow-50 space-y-3 text-center">
                  <p className="font-semibold text-yellow-800 text-sm">Escanea y paga antes de confirmar</p>
                  <img src={config.qr_pago_url} alt="QR" className="w-44 h-44 object-contain rounded-lg border bg-white mx-auto" />
                  <a href={config.qr_pago_url} download="qr-contryburguer.png" className="text-sm text-blue-600 underline">Descargar QR</a>
                  <p className="text-xs text-yellow-700">{config.instrucciones_pago}</p>
                  <p className="text-base font-black text-yellow-900">Monto: ${total.toFixed(2)}</p>
                </div>
              )}

              <button onClick={enviarPedido} disabled={enviando} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50">
                {enviando ? "Enviando..." : cliente.metodo_pago === "qr" ? "✅ Ya pagué, confirmar" : "Confirmar Pedido"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
