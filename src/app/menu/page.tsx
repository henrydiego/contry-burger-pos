"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

/* ─── Types ─── */
interface Producto {
  id: string; nombre: string; categoria: string
  precio_venta: number; activo: boolean
  imagen_url: string | null; agotado: boolean
}
interface CartItem {
  producto_id: string; nombre: string
  cantidad: number; precio_unitario: number; subtotal: number
}
interface Config {
  qr_pago_url: string; instrucciones_pago: string
  hora_apertura: string; hora_cierre: string; abierto: boolean
  tiempo_estimado: string; costo_envio: number; pedido_minimo: number
  mensaje_bienvenida: string; whatsapp_phone: string
}
type Step = "menu" | "datos" | "confirmacion"
type Tab = "inicio" | "menu" | "perfil"

const CAT_ICON: Record<string, string> = {
  Hamburguesas: "🍔", "Hot Dogs": "🌭", Bebidas: "🥤", Combos: "🎁", Acompanantes: "🍟",
}

function estaAbierto(cfg: Config) {
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
  const [carritoOpen, setCarritoOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("menu")
  const [addedId, setAddedId] = useState<string | null>(null)
  const [config, setConfig] = useState<Config>({
    qr_pago_url: "", instrucciones_pago: "", hora_apertura: "00:00",
    hora_cierre: "23:59", abierto: true, tiempo_estimado: "30-45 min",
    costo_envio: 0, pedido_minimo: 0, mensaje_bienvenida: "", whatsapp_phone: "",
  })
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
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
    const saved = sessionStorage.getItem("repeat_order")
    if (saved) {
      try { setCarrito(JSON.parse(saved)) } catch { /* ignore */ }
      sessionStorage.removeItem("repeat_order")
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) applyUser(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) applyUser(session.user)
      else setGoogleUser(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  function applyUser(user: { user_metadata?: Record<string, string>; email?: string }) {
    const name = user.user_metadata?.full_name || user.user_metadata?.name || ""
    setGoogleUser({ name, email: user.email || "" })
    setCliente(prev => ({ ...prev, nombre: name }))
  }

  async function loadAll() {
    const [{ data: prods }, { data: cfg }] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true).order("categoria"),
      supabase.from("configuracion").select("*").eq("id", 1).single(),
    ])
    setProductos(prods || [])
    if (cfg) setConfig(prev => ({ ...prev, ...cfg }))
    setLoading(false)
  }

  async function logoutCliente() {
    await supabase.auth.signOut()
    setGoogleUser(null)
    setCliente({ nombre: "", telefono: "", notas: "", metodo_pago: "efectivo", direccion: "", latitud: null, longitud: null })
  }

  async function loginConGoogle() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/menu` },
    })
  }

  function obtenerUbicacion() {
    if (!navigator.geolocation) { alert("Tu navegador no soporta GPS"); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setCliente(prev => ({ ...prev, latitud: pos.coords.latitude, longitud: pos.coords.longitude })); setGpsLoading(false) },
      () => { alert("No se pudo obtener ubicación. Da permiso al GPS."); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function validarCupon() {
    if (!cuponInput.trim()) return
    setValidandoCupon(true); setCuponError(""); setCuponAplicado(null)
    const res = await fetch("/api/validar-cupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: cuponInput, total: subtotalProductos }),
    })
    const data = await res.json()
    setValidandoCupon(false)
    if (data.ok) setCuponAplicado({ codigo: data.cupon.codigo, descuento: data.descuento })
    else setCuponError(data.error || "Cupón inválido")
  }

  const categorias = ["Todos", ...Array.from(new Set(productos.map(p => p.categoria)))]
  const productosFiltrados = categoriaFiltro === "Todos" ? productos : productos.filter(p => p.categoria === categoriaFiltro)

  function agregarAlCarrito(producto: Producto) {
    if (producto.agotado) return
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === producto.id)
      if (existe) return prev.map(i => i.producto_id === producto.id
        ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario } : i)
      return [...prev, { producto_id: producto.id, nombre: producto.nombre, cantidad: 1, precio_unitario: producto.precio_venta, subtotal: producto.precio_venta }]
    })
    setAddedId(producto.id)
    setTimeout(() => setAddedId(null), 500)
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito(prev =>
      prev.map(item => {
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
  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0)

  async function enviarPedido() {
    if (!cliente.nombre.trim() || !cliente.telefono.trim()) {
      alert("Por favor ingresa tu nombre y teléfono"); return
    }
    setEnviando(true)
    try {
      const res = await fetch("/api/crear-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
          cliente_nombre: cliente.nombre, cliente_telefono: cliente.telefono,
          notas: cliente.notas, metodo_pago: cliente.metodo_pago,
          latitud: cliente.latitud, longitud: cliente.longitud,
          direccion: cliente.direccion, cupon_codigo: cuponAplicado?.codigo || null,
        }),
      })
      const data = await res.json()
      if (!data.ok) { alert(data.error || "Error al enviar el pedido."); setEnviando(false); return }
      router.push(`/menu/seguimiento?order=${data.order_id}`)
    } catch (err) {
      console.error(err); alert("Error al enviar el pedido."); setEnviando(false)
    }
  }

  /* ─── Loading ─── */
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🍔</div>
        <p className="text-gray-400 text-sm tracking-wide">Cargando menú...</p>
      </div>
    </div>
  )

  /* ─── Cerrado ─── */
  if (!estaAbierto(config)) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-7xl mb-4">🔴</div>
      <h1 className="text-3xl font-black text-white mb-2">Estamos cerrados</h1>
      <p className="text-gray-400 text-lg mb-1">Contry Burger</p>
      <p className="text-gray-500">Horario: {config.hora_apertura} – {config.hora_cierre}</p>
      {config.mensaje_bienvenida && <p className="text-gray-400 mt-4 max-w-sm">{config.mensaje_bienvenida}</p>}
    </div>
  )

  /* ─── Checkout Steps ─── */
  if (step === "datos" || step === "confirmacion") {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header checkout */}
        <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/60 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => step === "confirmacion" ? setStep("datos") : setStep("menu")}
            className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 text-lg transition-colors">
            ‹
          </button>
          <div>
            <h1 className="font-bold text-white text-base leading-none">
              {step === "datos" ? "Tu Pedido" : "Confirmar Pedido"}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Contry Burger · {config.tiempo_estimado}</p>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-5 pb-12 space-y-4">

          {/* ── STEP: Datos ── */}
          {step === "datos" && (
            <>
              {/* Resumen carrito */}
              <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
                <h3 className="font-semibold text-sm text-gray-300 mb-3">Resumen del pedido</h3>
                {carrito.map(item => (
                  <div key={item.producto_id} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 bg-red-950/60 border border-red-900/40 rounded-full px-2.5 py-0.5 shrink-0">
                      <button onClick={() => cambiarCantidad(item.producto_id, -1)} className="text-red-400 font-bold text-xs w-3">−</button>
                      <span className="text-red-300 font-bold text-xs w-4 text-center">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.producto_id, 1)} className="text-red-400 font-bold text-xs w-3">+</button>
                    </div>
                    <span className="text-gray-300 flex-1">{item.nombre}</span>
                    <span className="text-white font-semibold shrink-0">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-800 pt-2 mt-1 space-y-1">
                  <div className="flex justify-between text-sm text-gray-400"><span>Subtotal</span><span>${subtotalProductos.toFixed(2)}</span></div>
                  {costoEnvio > 0 && <div className="flex justify-between text-sm text-gray-400"><span>Envío</span><span>+${costoEnvio.toFixed(2)}</span></div>}
                  {descuento > 0 && <div className="flex justify-between text-sm text-green-400"><span>Descuento</span><span>−${descuento.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-black text-xl pt-1 border-t border-gray-800">
                    <span>Total</span><span className="text-red-500">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Login opcional */}
              {!googleUser ? (
                <div className="bg-gradient-to-br from-red-950/50 to-gray-900 border border-red-900/40 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="font-bold text-white text-sm">¿Pedido más rápido la próxima vez? 🚀</p>
                    <p className="text-gray-400 text-xs mt-0.5">Inicia sesión con Google — completamente opcional</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-300">
                    {[
                      "Tus datos se guardan solos",
                      "Pedidos más rápidos",
                      "Historial de pedidos",
                      "Cupones exclusivos",
                    ].map(b => (
                      <div key={b} className="flex items-center gap-1.5">
                        <span className="text-green-400 font-bold">✓</span> {b}
                      </div>
                    ))}
                  </div>
                  <button onClick={loginConGoogle} disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-gray-800 font-semibold py-2.5 rounded-xl hover:bg-gray-100 disabled:opacity-60 transition-all active:scale-95 text-sm">
                    <GoogleIcon />
                    {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
                  </button>
                  <p className="text-xs text-gray-600 text-center">O completa los datos manualmente abajo ↓</p>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-black text-base shrink-0">
                    {googleUser.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{googleUser.name}</p>
                    <p className="text-xs text-gray-400 truncate">{googleUser.email}</p>
                  </div>
                  <button onClick={logoutCliente} className="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0">Salir</button>
                </div>
              )}

              {/* Datos de contacto */}
              <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-300">Datos de contacto</h3>
                <input type="text" placeholder="Tu nombre *" value={cliente.nombre}
                  onChange={e => setCliente({ ...cliente, nombre: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 placeholder:text-gray-600 transition-colors" />
                <input type="tel" placeholder="Tu teléfono *" value={cliente.telefono}
                  onChange={e => setCliente({ ...cliente, telefono: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 placeholder:text-gray-600 transition-colors" />
                <textarea placeholder="Notas (sin cebolla, extra salsa...)" value={cliente.notas}
                  onChange={e => setCliente({ ...cliente, notas: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 placeholder:text-gray-600 transition-colors" rows={2} />
                <select value={cliente.metodo_pago} onChange={e => setCliente({ ...cliente, metodo_pago: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition-colors">
                  <option value="efectivo">💵 Pago en Efectivo</option>
                  <option value="tarjeta">💳 Pago con Tarjeta</option>
                  <option value="qr">📱 Pago QR / Yape / BCP</option>
                </select>
              </div>

              {/* Ubicación */}
              <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-gray-300">📍 Delivery (opcional)</h3>
                  {config.costo_envio > 0 && <span className="text-xs text-blue-400 bg-blue-950/60 border border-blue-900/40 px-2 py-0.5 rounded-full">+${config.costo_envio.toFixed(2)} envío</span>}
                </div>
                {cliente.latitud ? (
                  <div className="flex items-center justify-between bg-green-950/40 border border-green-900/40 rounded-xl px-3 py-2.5">
                    <span className="text-green-400 text-sm font-medium">✅ Ubicación capturada</span>
                    <div className="flex gap-3">
                      <a href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline">Ver mapa</a>
                      <button onClick={() => setCliente(c => ({ ...c, latitud: null, longitud: null }))} className="text-xs text-red-400 underline">Quitar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={obtenerUbicacion} disabled={gpsLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-colors active:scale-95">
                    {gpsLoading ? <><Spinner />Obteniendo...</> : "📍 Compartir mi ubicación GPS"}
                  </button>
                )}
                <input type="text" placeholder="Dirección o referencia (opcional)" value={cliente.direccion}
                  onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 placeholder:text-gray-600 transition-colors" />
              </div>

              {/* Cupón */}
              <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-300">🎫 Cupón de descuento</h3>
                {cuponAplicado ? (
                  <div className="flex items-center justify-between bg-green-950/40 border border-green-900/40 rounded-xl px-3 py-2.5">
                    <span className="text-green-400 text-sm font-bold">✅ {cuponAplicado.codigo} — −${cuponAplicado.descuento.toFixed(2)}</span>
                    <button onClick={() => { setCuponAplicado(null); setCuponInput("") }} className="text-xs text-red-400 underline">Quitar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="CÓDIGO" value={cuponInput}
                      onChange={e => { setCuponInput(e.target.value.toUpperCase()); setCuponError("") }}
                      className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 placeholder:text-gray-600" />
                    <button onClick={validarCupon} disabled={validandoCupon || !cuponInput.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0 transition-colors">
                      {validandoCupon ? "..." : "Aplicar"}
                    </button>
                  </div>
                )}
                {cuponError && <p className="text-red-400 text-xs">{cuponError}</p>}
              </div>

              <button onClick={() => setStep("confirmacion")}
                disabled={!cliente.nombre.trim() || !cliente.telefono.trim()}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/30">
                Continuar →
              </button>
            </>
          )}

          {/* ── STEP: Confirmación ── */}
          {step === "confirmacion" && (
            <>
              <div className="bg-gray-900 rounded-2xl p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-gray-300 mb-3">Datos del pedido</h3>
                {[
                  ["Nombre", cliente.nombre],
                  ["Teléfono", cliente.telefono],
                  ...(cliente.notas ? [["Notas", cliente.notas]] : []),
                  ["Pago", cliente.metodo_pago === "qr" ? "QR / Yape / BCP" : cliente.metodo_pago === "tarjeta" ? "Tarjeta" : "Efectivo"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
                {(cliente.latitud || cliente.direccion) && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Entrega</span>
                    <div className="text-right space-y-0.5">
                      {cliente.latitud && <a href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs block">📍 Ver en mapa</a>}
                      {cliente.direccion && <span className="text-white block">{cliente.direccion}</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-300 text-sm mb-3">Artículos</h3>
                {carrito.map(item => (
                  <div key={item.producto_id} className="flex justify-between text-sm">
                    <span className="text-gray-300">{item.cantidad}× {item.nombre}</span>
                    <span className="text-white font-medium">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-800 pt-2 mt-1 space-y-1">
                  {costoEnvio > 0 && <div className="flex justify-between text-sm text-gray-400"><span>Envío</span><span>+${costoEnvio.toFixed(2)}</span></div>}
                  {descuento > 0 && <div className="flex justify-between text-sm text-green-400"><span>Descuento ({cuponAplicado?.codigo})</span><span>−${descuento.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-black text-2xl pt-1 border-t border-gray-800">
                    <span>Total</span><span className="text-red-500">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* QR pago */}
              {cliente.metodo_pago === "qr" && config.qr_pago_url && (
                <div className="bg-yellow-950/40 border border-yellow-800/40 rounded-2xl p-4 text-center space-y-3">
                  <p className="font-semibold text-yellow-300 text-sm">Escanea y paga antes de confirmar</p>
                  <img src={config.qr_pago_url} alt="QR Pago" className="w-44 h-44 object-contain rounded-xl border border-yellow-800/30 bg-white mx-auto" />
                  <a href={config.qr_pago_url} download className="text-sm text-blue-400 underline block">Descargar QR</a>
                  {config.instrucciones_pago && <p className="text-xs text-yellow-400">{config.instrucciones_pago}</p>}
                  <p className="text-xl font-black text-yellow-300">Monto: ${total.toFixed(2)}</p>
                </div>
              )}

              <button onClick={enviarPedido} disabled={enviando}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-base transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-900/30">
                {enviando ? "Enviando pedido..." : cliente.metodo_pago === "qr" ? "✅ Ya pagué · Confirmar pedido" : "🍔 Confirmar Pedido"}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ─── Main App UI ─── */
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* App Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-red-500 tracking-tight leading-none">Contry Burger</h1>
            <p className="text-xs text-gray-500 mt-0.5">⏱ {config.tiempo_estimado} · 🟢 Abierto</p>
          </div>
          <div className="flex items-center gap-2">
            {config.whatsapp_phone && (
              <a href={`https://wa.me/${config.whatsapp_phone.replace(/\D/g, "")}?text=Hola%20Contry%20Burger`}
                target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 bg-green-600/20 hover:bg-green-600/30 rounded-full flex items-center justify-center transition-colors">
                <WhatsAppIcon className="w-4 h-4 text-green-400" />
              </a>
            )}
          </div>
        </div>
        {config.mensaje_bienvenida && (
          <div className="bg-red-900/20 border-t border-red-900/20 px-4 py-1.5 text-xs text-red-300 text-center">
            {config.mensaje_bienvenida}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full pb-24">

        {/* TAB: Inicio */}
        {activeTab === "inicio" && (
          <div className="px-4 py-5 space-y-5 animate-fade-in">
            {/* Hero */}
            <div className="bg-gradient-to-br from-red-950/70 via-gray-900 to-gray-950 rounded-3xl p-6 text-center border border-red-900/20">
              <div className="text-6xl mb-3">🍔</div>
              <h2 className="text-2xl font-black text-white leading-tight">Bienvenido a<br />Contry Burger</h2>
              <p className="text-gray-400 text-sm mt-2 mb-4">{config.mensaje_bienvenida || "Las mejores hamburguesas de la ciudad"}</p>
              <button onClick={() => setActiveTab("menu")}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-red-900/40">
                Ver menú →
              </button>
            </div>

            {/* Info rápida */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800/50">
                <p className="text-2xl mb-1">⏱</p>
                <p className="text-white font-bold text-sm">{config.tiempo_estimado}</p>
                <p className="text-gray-500 text-xs">Tiempo estimado</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800/50">
                <p className="text-2xl mb-1">{config.costo_envio > 0 ? "🚗" : "🏪"}</p>
                <p className="text-white font-bold text-sm">{config.costo_envio > 0 ? `$${config.costo_envio.toFixed(2)}` : "Gratis"}</p>
                <p className="text-gray-500 text-xs">Envío</p>
              </div>
              {config.pedido_minimo > 0 && (
                <div className="col-span-2 bg-yellow-950/30 border border-yellow-800/30 rounded-2xl p-3 text-center">
                  <p className="text-yellow-300 text-sm font-medium">Pedido mínimo: ${config.pedido_minimo.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Categorías */}
            <div>
              <p className="text-white font-bold mb-3 text-sm">Explorar categorías</p>
              <div className="grid grid-cols-3 gap-2.5">
                {categorias.filter(c => c !== "Todos").map(cat => (
                  <button key={cat} onClick={() => { setCategoriaFiltro(cat); setActiveTab("menu") }}
                    className="bg-gray-900 hover:bg-gray-800 border border-gray-800/50 rounded-2xl p-3.5 text-center transition-all active:scale-95">
                    <div className="text-2xl mb-1">{CAT_ICON[cat] ?? "🍽️"}</div>
                    <p className="text-xs text-gray-300 font-medium leading-tight">{cat}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Menú */}
        {activeTab === "menu" && (
          <div className="px-3 py-3 animate-fade-in">
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
              {categorias.map(cat => (
                <button key={cat} onClick={() => setCategoriaFiltro(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                    categoriaFiltro === cat
                      ? "bg-red-600 text-white shadow-md shadow-red-900/30"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700/50"
                  }`}>
                  {cat !== "Todos" && CAT_ICON[cat] ? `${CAT_ICON[cat]} ` : ""}{cat}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-3">
              {productosFiltrados.map(producto => {
                const enCarrito = carrito.find(c => c.producto_id === producto.id)
                const justAdded = addedId === producto.id
                return (
                  <div key={producto.id}
                    className={`bg-gray-900 border rounded-2xl overflow-hidden flex flex-col transition-all ${
                      producto.agotado ? "opacity-50 border-gray-800/30" : "border-gray-800/50 hover:border-gray-700"
                    } ${justAdded ? "ring-2 ring-red-500 scale-[1.02]" : ""}`}>
                    {/* Image */}
                    <div className="relative">
                      {producto.imagen_url ? (
                        <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-36 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-gray-800 flex items-center justify-center text-5xl">
                          {CAT_ICON[producto.categoria] ?? "🍽️"}
                        </div>
                      )}
                      {producto.agotado && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="bg-red-700 text-white text-xs font-bold px-3 py-1 rounded-full">Agotado</span>
                        </div>
                      )}
                      {enCarrito && !producto.agotado && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-pop-in">
                          {enCarrito.cantidad}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-1">{producto.nombre}</h3>
                      <p className="text-xl font-black text-red-500 mb-3">${producto.precio_venta.toFixed(2)}</p>
                      {producto.agotado ? (
                        <div className="mt-auto bg-gray-800 text-gray-500 text-xs text-center py-2 rounded-xl">Agotado hoy</div>
                      ) : enCarrito ? (
                        <div className="flex items-center justify-between mt-auto bg-gray-800 rounded-xl p-1">
                          <button onClick={() => cambiarCantidad(producto.id, -1)}
                            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-white flex items-center justify-center transition-colors text-base">−</button>
                          <span className="font-black text-white text-base">{enCarrito.cantidad}</span>
                          <button onClick={() => cambiarCantidad(producto.id, 1)}
                            className="w-8 h-8 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white flex items-center justify-center transition-colors text-base">+</button>
                        </div>
                      ) : (
                        <button onClick={() => agregarAlCarrito(producto)}
                          className="mt-auto bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-1">
                          <span className="text-lg leading-none">+</span> Agregar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB: Perfil */}
        {activeTab === "perfil" && (
          <div className="px-4 py-5 space-y-4 animate-fade-in">
            {googleUser ? (
              <>
                <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800/50">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-lg">
                    {googleUser.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <h2 className="text-white font-bold text-lg">{googleUser.name}</h2>
                  <p className="text-gray-400 text-sm">{googleUser.email}</p>
                </div>
                <a href="/menu/mis-pedidos"
                  className="flex items-center justify-between bg-gray-900 rounded-2xl p-4 hover:bg-gray-800 transition-colors border border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="text-white font-semibold text-sm">Mis Pedidos</p>
                      <p className="text-gray-400 text-xs">Ver historial completo</p>
                    </div>
                  </div>
                  <span className="text-gray-600 text-xl">›</span>
                </a>
                <button onClick={logoutCliente}
                  className="w-full bg-gray-900 border border-gray-800/50 text-red-400 hover:text-red-300 hover:bg-gray-800 py-3 rounded-2xl font-semibold transition-colors text-sm active:scale-95">
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800/50">
                  <div className="text-5xl mb-3">👤</div>
                  <h2 className="text-white font-bold text-lg mb-1">Inicia sesión</h2>
                  <p className="text-gray-400 text-sm">Disfruta una mejor experiencia</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-4 space-y-2.5 border border-gray-800/50">
                  {[
                    "Guarda tus datos automáticamente",
                    "Pedidos más rápidos la próxima vez",
                    "Acceso a ofertas y cupones exclusivos",
                    "Historial completo de tus pedidos",
                  ].map(b => (
                    <div key={b} className="flex items-center gap-3 text-sm">
                      <span className="text-green-400 font-bold text-base">✓</span>
                      <span className="text-gray-300">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={loginConGoogle} disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3.5 rounded-2xl hover:bg-gray-100 disabled:opacity-60 transition-all active:scale-95 shadow-lg">
                  <GoogleIcon />
                  {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── Bottom Sheet Carrito ─── */}
      {carritoOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setCarritoOpen(false)} />
          {/* Sheet */}
          <div className="relative bg-gray-900 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up border-t border-gray-700/50">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
              <h2 className="text-white font-black text-lg">Tu carrito</h2>
              <button onClick={() => setCarritoOpen(false)}
                className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-xl leading-none">
                ×
              </button>
            </div>

            {/* Items */}
            <div className="overflow-y-auto flex-1 px-5 space-y-2 pb-3">
              {carrito.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-5xl mb-3">🛒</p>
                  <p className="text-gray-400 mb-4">Tu carrito está vacío</p>
                  <button onClick={() => { setCarritoOpen(false); setActiveTab("menu") }}
                    className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-red-700 transition-colors">
                    Explorar menú
                  </button>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.producto_id} className="flex items-center gap-3 bg-gray-800 rounded-2xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{item.nombre}</p>
                      <p className="text-red-400 font-bold text-sm">${item.subtotal.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => cambiarCantidad(item.producto_id, -1)}
                        className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-white flex items-center justify-center transition-colors text-base">−</button>
                      <span className="text-white font-black text-sm w-5 text-center">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.producto_id, 1)}
                        className="w-8 h-8 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white flex items-center justify-center transition-colors text-base">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {carrito.length > 0 && (
              <div className="px-5 pb-6 pt-3 border-t border-gray-800 space-y-3 shrink-0 safe-area-pb">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{totalItems} artículo{totalItems !== 1 ? "s" : ""}</span>
                  <span className="text-white font-black text-2xl">${subtotalProductos.toFixed(2)}</span>
                </div>
                {config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo && (
                  <p className="text-yellow-400 text-xs text-center">Mínimo: ${config.pedido_minimo.toFixed(2)} · Falta ${(config.pedido_minimo - subtotalProductos).toFixed(2)}</p>
                )}
                <button
                  onClick={() => { setCarritoOpen(false); setStep("datos") }}
                  disabled={config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/30">
                  Hacer pedido · ${subtotalProductos.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Bottom Navigation ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800/50 safe-area-pb">
        <div className="max-w-2xl mx-auto flex items-stretch">
          {([
            { id: "inicio" as const, label: "Inicio", Icon: HomeIcon, badge: 0 },
            { id: "menu" as const, label: "Menú", Icon: MenuIcon2, badge: 0 },
            { id: "carrito" as const, label: "Carrito", Icon: CartIcon, badge: totalItems },
            { id: "perfil" as const, label: "Perfil", Icon: ProfileIcon, badge: 0 },
          ]).map(({ id, label, Icon, badge }) => {
            const isActive = id === "carrito" ? carritoOpen : activeTab === id
            return (
              <button key={id}
                onClick={() => {
                  if (id === "carrito") { setCarritoOpen(o => !o) }
                  else { setCarritoOpen(false); setActiveTab(id) }
                }}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${
                  isActive ? "text-red-500" : "text-gray-600 hover:text-gray-400"
                }`}>
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-xs font-black min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center leading-none">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/* ─── Icons & Helpers ─── */
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.8 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.4-4z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z" />
      <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.9 13.4-5l-6.2-5.3C29.3 37 26.8 38 24 38c-5.2 0-9.6-3.2-11.3-7.8l-6.5 5C9.6 41 16.3 45.5 24 45.5z" />
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.4l6.2 5.3c3.6-3.3 5.8-8.3 5.8-14.2 0-1.4-.1-2.7-.4-4z" />
    </svg>
  )
}

function Spinner() {
  return <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
}

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
}

function MenuIcon2({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
}

function CartIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}

function ProfileIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
}

function WhatsAppIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
}
