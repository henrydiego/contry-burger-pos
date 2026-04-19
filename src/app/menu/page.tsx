"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

/* ─── Types ─── */
interface Producto {
  id: string; nombre: string; categoria: string
  precio_venta: number; activo: boolean
  imagen_url: string | null; agotado: boolean
  descripcion: string | null
}
interface CartItem {
  producto_id: string; nombre: string
  cantidad: number; precio_unitario: number; subtotal: number
}
interface RedSocial { plataforma: string; url: string }
interface Config {
  qr_pago_url: string; instrucciones_pago: string
  hora_apertura: string; hora_cierre: string; abierto: boolean
  tiempo_estimado: string; costo_envio: number; pedido_minimo: number
  mensaje_bienvenida: string; whatsapp_phone: string
  redes_sociales: RedSocial[]; direccion_local: string
}
interface CategoriaDB {
  nombre: string; icono: string; orden: number; activo: boolean; es_extra: boolean
}
type Step = "menu" | "datos" | "confirmacion"
type Tab = "inicio" | "menu" | "perfil"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const SOCIAL_ICONS: Record<string, { icon: string; color: string }> = {
  instagram: { icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z", color: "#E1306C" },
  tiktok: { icon: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.95a8.16 8.16 0 004.77 1.52V7.01a4.85 4.85 0 01-1-.32z", color: "#000000" },
  facebook: { icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z", color: "#1877F2" },
  twitter: { icon: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z", color: "#000000" },
  youtube: { icon: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z", color: "#FF0000" },
}

const CAT_ICON: Record<string, string> = {
  Hamburguesas: "🍔", "Hot Dogs": "🌭", Bebidas: "🥤", Combos: "🎁", Acompanantes: "🍟",
}

function generarSlots(apertura: string, cierre: string): string[] {
  const slots: string[] = ["Lo antes posible"]
  try {
    const [hA, mA] = apertura.split(":").map(Number)
    const [hC, mC] = cierre.split(":").map(Number)
    let mins = hA * 60 + mA
    const finMins = hC * 60 + mC
    while (mins <= finMins) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
      mins += 30
    }
  } catch { /* fallback: solo "Lo antes posible" */ }
  return slots
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

  /* ─── Refs para cleanup ─── */
  const mountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  /* ─── State ─── */
  const [productos, setProductos] = useState<Producto[]>([])
  const [categoriasDB, setCategoriasDB] = useState<CategoriaDB[]>([])
  const [carrito, setCarrito] = useState<CartItem[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>("menu")
  const [enviando, setEnviando] = useState(false)
  const [carritoOpen, setCarritoOpen] = useState(false) // mobile bottom sheet
  const [carritoTab, setCarritoTab] = useState<"pedido" | "extras">("pedido")
  const [activeTab, setActiveTab] = useState<Tab>("menu")
  const [addedId, setAddedId] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{
    orderId: string; whatsappPhone: string | null
    metodoPago: string; totalPagado: number; nombreCliente: string
  } | null>(null)
  const [config, setConfig] = useState<Config>({
    qr_pago_url: "", instrucciones_pago: "", hora_apertura: "00:00",
    hora_cierre: "23:59", abierto: true, tiempo_estimado: "30-45 min",
    costo_envio: 0, pedido_minimo: 0, mensaje_bienvenida: "", whatsapp_phone: "",
    redes_sociales: [], direccion_local: "",
  })
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [detalleProducto, setDetalleProducto] = useState<Producto | null>(null)
  const [recetasDetalle, setRecetasDetalle] = useState<{ ingrediente_nombre: string; cantidad: number; unidad: string }[]>([])
  const [detalleCantidad, setDetalleCantidad] = useState(1)
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [cuponInput, setCuponInput] = useState("")
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; descuento: number } | null>(null)
  const [cuponError, setCuponError] = useState("")
  const [validandoCupon, setValidandoCupon] = useState(false)
  const [cliente, setCliente] = useState({
    nombre: "", telefono: "", notas: "", metodo_pago: "qr",
    direccion: "", latitud: null as number | null, longitud: null as number | null,
    tipo_entrega: "local" as "local" | "mesa" | "delivery",
    numero_mesa: "", hora_recojo: "Lo antes posible",
  })

  /* ─── Effects ─── */
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    // Detectar si ya está instalada como PWA
    if (window.matchMedia("(display-mode: standalone)").matches) { setIsInstalled(true); return }
    const dismissed = sessionStorage.getItem("pwa_dismissed")
    if (dismissed) { setInstallDismissed(true); return }
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener("beforeinstallprompt", handler as EventListener)
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener)
  }, [])

  useEffect(() => {
    // Marcar como montado
    mountedRef.current = true

    loadAll()
    const saved = sessionStorage.getItem("repeat_order")
    if (saved) {
      try { setCarrito(JSON.parse(saved)) } catch { /* ignore */ }
      sessionStorage.removeItem("repeat_order")
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && mountedRef.current) applyUser(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mountedRef.current) return
      if (session?.user) applyUser(session.user)
      else setGoogleUser(null)
    })
    return () => {
      mountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      subscription.unsubscribe()
    }
  }, [])

  function applyUser(user: { user_metadata?: Record<string, string>; email?: string }) {
    const name = user.user_metadata?.full_name || user.user_metadata?.name || ""
    setGoogleUser({ name, email: user.email || "" })
    setCliente(prev => ({ ...prev, nombre: name }))
  }

  async function loadAll() {
    // Cancelar llamada anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const [{ data: prods }, { data: cfg }, { data: cats }] = await Promise.all([
        supabase.from("productos").select("*").eq("activo", true),
        supabase.from("configuracion").select("*").eq("id", 1).single(),
        supabase.from("categorias").select("nombre,icono,orden,activo,es_extra").eq("activo", true).order("orden"),
      ])

      // Solo actualizar si el componente sigue montado
      if (!mountedRef.current) return

      setProductos(prods || [])
      if (cfg) setConfig(prev => ({ ...prev, ...cfg }))
      setCategoriasDB(cats || [])
    } catch (err) {
      console.error("Error loadAll:", err)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  async function instalarApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === "accepted") setIsInstalled(true)
    setInstallPrompt(null)
  }

  function dismissInstall() {
    setInstallDismissed(true)
    sessionStorage.setItem("pwa_dismissed", "1")
  }

  async function logoutCliente() {
    await supabase.auth.signOut()
    setGoogleUser(null)
    setCliente({ nombre: "", telefono: "", notas: "", metodo_pago: "qr", direccion: "", latitud: null, longitud: null, tipo_entrega: "local", numero_mesa: "", hora_recojo: "Lo antes posible" })
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
      () => { alert("No se pudo obtener ubicación."); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function validarCupon() {
    if (!cuponInput.trim()) return
    setValidandoCupon(true); setCuponError(""); setCuponAplicado(null)
    const res = await fetch("/api/validar-cupon", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: cuponInput, total: subtotalProductos }),
    })
    const data = await res.json()
    setValidandoCupon(false)
    if (data.ok) setCuponAplicado({ codigo: data.cupon.codigo, descuento: data.descuento })
    else setCuponError(data.error || "Cupón inválido")
  }

  // Categorías ordenadas según config; las que no están en DB van al final
  const catNombresOrdenados = categoriasDB.map(c => c.nombre)
  const catSinOrden = Array.from(new Set(productos.map(p => p.categoria))).filter(c => !catNombresOrdenados.includes(c))
  const categorias = ["Todos", ...catNombresOrdenados.filter(c => productos.some(p => p.categoria === c)), ...catSinOrden]

  // Icono: primero busca en DB, luego CAT_ICON hardcoded
  const getCatIcon = (cat: string) => {
    const db = categoriasDB.find(c => c.nombre === cat)
    return db?.icono || CAT_ICON[cat] || "🍽️"
  }

  const productosFiltrados = categoriaFiltro === "Todos" ? productos : productos.filter(p => p.categoria === categoriaFiltro)

  // Productos extras: categorías marcadas como es_extra
  const categoriasExtra = categoriasDB.filter(c => c.es_extra).map(c => c.nombre)
  const productosExtra = productos.filter(p => categoriasExtra.includes(p.categoria) && !p.agotado)

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

  async function abrirDetalle(producto: Producto) {
    setDetalleProducto(producto)
    const enCarrito = carrito.find(c => c.producto_id === producto.id)
    setDetalleCantidad(enCarrito ? enCarrito.cantidad : 1)
    setRecetasDetalle([])
    const { data } = await supabase
      .from("recetas")
      .select("ingrediente_nombre, cantidad, unidad")
      .eq("producto_id", producto.id)
    setRecetasDetalle(data || [])
  }

  function agregarDesdeDetalle() {
    if (!detalleProducto || detalleProducto.agotado) return
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === detalleProducto.id)
      if (existe) {
        return prev.map(i => i.producto_id === detalleProducto.id
          ? { ...i, cantidad: detalleCantidad, subtotal: detalleCantidad * i.precio_unitario } : i)
      }
      return [...prev, {
        producto_id: detalleProducto.id, nombre: detalleProducto.nombre,
        cantidad: detalleCantidad, precio_unitario: detalleProducto.precio_venta,
        subtotal: detalleCantidad * detalleProducto.precio_venta,
      }]
    })
    setAddedId(detalleProducto.id)
    setTimeout(() => setAddedId(null), 500)
    setDetalleProducto(null)
  }

  const subtotalProductos = carrito.reduce((s, i) => s + i.subtotal, 0)
  const costoEnvio = (cliente.tipo_entrega === "delivery" && cliente.latitud) ? config.costo_envio : 0
  const descuento = cuponAplicado?.descuento ?? 0
  const total = subtotalProductos + costoEnvio - descuento
  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0)

  async function enviarPedido() {
    if (!cliente.nombre.trim() || !cliente.telefono.trim()) { alert("Por favor ingresa tu nombre y teléfono"); return }
    if (cliente.tipo_entrega === "mesa" && !cliente.numero_mesa.trim()) { alert("Por favor ingresa el número de mesa"); return }
    setEnviando(true)
    try {
      const res = await fetch("/api/crear-pedido", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
          cliente_nombre: cliente.nombre, cliente_telefono: cliente.telefono,
          notas: cliente.notas, metodo_pago: cliente.metodo_pago,
          latitud: cliente.latitud, longitud: cliente.longitud,
          direccion: cliente.direccion, cupon_codigo: cuponAplicado?.codigo || null,
          tipo_entrega: cliente.tipo_entrega, numero_mesa: cliente.numero_mesa,
          hora_recojo: cliente.tipo_entrega === "local" ? cliente.hora_recojo : null,
        }),
      })
      let data: Record<string, unknown>
      try { data = await res.json() } catch {
        const text = await res.text().catch(() => "sin respuesta")
        alert(`Error del servidor (${res.status}): ${text.slice(0, 300)}`)
        setEnviando(false); return
      }
      if (!data.ok) { alert((data.error as string) || "Error al enviar el pedido."); setEnviando(false); return }
      setPedidoConfirmado({
        orderId: data.order_id as string,
        whatsappPhone: (data.whatsapp_phone as string) || null,
        metodoPago: cliente.metodo_pago,
        totalPagado: total,
        nombreCliente: cliente.nombre,
      })
      // Solo auto-redirigir si NO es pago QR (QR espera confirmación manual)
      if (cliente.metodo_pago !== "qr") {
        setTimeout(() => router.push(`/menu/seguimiento?order=${encodeURIComponent(data.order_id as string)}`), 3500)
      }
    } catch (err) {
      console.error(err); alert("Error de red: " + (err instanceof Error ? err.message : String(err))); setEnviando(false)
    }
  }

  /* ─── Loading ─── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center cb-cream">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🍔</div>
        <p className="text-sm tracking-wide font-manrope" style={{ color: "#6B4A3A" }}>Cargando menú...</p>
      </div>
    </div>
  )

  /* ─── Cerrado ─── */
  if (!estaAbierto(config)) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center cb-cream">
      <div className="text-7xl mb-4">🔴</div>
      <h1 className="text-3xl font-archivo mb-2" style={{ color: "#2A1810" }}>Estamos cerrados</h1>
      <p className="text-lg mb-1 font-manrope" style={{ color: "#6B4A3A" }}>Contry Burger</p>
      <p className="font-manrope" style={{ color: "#6B4A3A" }}>Horario: {config.hora_apertura} – {config.hora_cierre}</p>
      {config.mensaje_bienvenida && <p className="mt-4 max-w-sm font-manrope" style={{ color: "#6B4A3A" }}>{config.mensaje_bienvenida}</p>}
    </div>
  )

  /* ─── Checkout (mobile + desktop responsive) ─── */
  if (step === "datos" || step === "confirmacion") {
    return (
      <div className="min-h-screen" style={{ background: "#FBF5EC" }}>
        <header className="sticky top-0 z-40 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3" style={{ background: "rgba(251,245,236,0.97)", borderColor: "#E8DCC6" }}>
          <button onClick={() => step === "confirmacion" ? setStep("datos") : setStep("menu")}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xl transition-colors"
            style={{ background: "#FFFFFF", border: "1px solid #E8DCC6", color: "#2A1810" }}>‹</button>
          <div>
            <h1 className="font-archivo text-base leading-none" style={{ color: "#2A1810" }}>
              {step === "datos" ? "Tu Pedido" : "Confirmar Pedido"}
            </h1>
            <p className="text-xs font-manrope mt-0.5" style={{ color: "#6B4A3A" }}>Contry Burger · {config.tiempo_estimado}</p>
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 py-5 pb-12 space-y-4">
          {/* ── STEP: Datos ── */}
          {step === "datos" && (
            <>
              {/* Resumen carrito */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <h3 className="font-manrope font-semibold text-sm mb-3" style={{ color: "#6B4A3A" }}>Resumen del pedido</h3>
                {carrito.map(item => (
                  <div key={item.producto_id} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 rounded-full px-2.5 py-0.5 shrink-0" style={{ background: "#F4EADB", border: "1px solid #E8DCC6" }}>
                      <button onClick={() => cambiarCantidad(item.producto_id, -1)} className="font-bold text-xs w-3" style={{ color: "#B0281B" }}>−</button>
                      <span className="font-bold text-xs w-4 text-center font-archivo" style={{ color: "#B0281B" }}>{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.producto_id, 1)} className="font-bold text-xs w-3" style={{ color: "#B0281B" }}>+</button>
                    </div>
                    <span className="font-manrope flex-1" style={{ color: "#2A1810" }}>{item.nombre}</span>
                    <span className="font-semibold font-manrope shrink-0" style={{ color: "#2A1810" }}>Bs{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-1 space-y-1" style={{ borderTop: "1px solid #E8DCC6" }}>
                  <div className="flex justify-between text-sm font-manrope" style={{ color: "#6B4A3A" }}><span>Subtotal</span><span>Bs{subtotalProductos.toFixed(2)}</span></div>
                  {costoEnvio > 0 && <div className="flex justify-between text-sm font-manrope" style={{ color: "#6B4A3A" }}><span>Envío</span><span>+Bs{costoEnvio.toFixed(2)}</span></div>}
                  {descuento > 0 && <div className="flex justify-between text-sm" style={{ color: "#3F8F43" }}><span>Descuento</span><span>−Bs{descuento.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-archivo text-xl pt-1" style={{ borderTop: "1px solid #E8DCC6", color: "#2A1810" }}>
                    <span>Total</span><span style={{ color: "#B0281B" }}>Bs{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Login opcional */}
              {!googleUser ? (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                  <div>
                    <p className="font-archivo text-sm" style={{ color: "#2A1810" }}>¿Pedido más rápido la próxima vez? 🚀</p>
                    <p className="text-xs font-manrope mt-0.5" style={{ color: "#6B4A3A" }}>Inicia sesión con Google — completamente opcional</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-manrope" style={{ color: "#6B4A3A" }}>
                    {["Tus datos se guardan solos", "Pedidos más rápidos", "Historial de pedidos", "Cupones exclusivos"].map(b => (
                      <div key={b} className="flex items-center gap-1.5"><span className="font-bold" style={{ color: "#3F8F43" }}>✓</span> {b}</div>
                    ))}
                  </div>
                  <button onClick={loginConGoogle} disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white font-semibold py-2.5 rounded-xl hover:bg-gray-100 disabled:opacity-60 transition-all active:scale-95 text-sm font-manrope"
                    style={{ color: "#2A1810", border: "1px solid #E8DCC6" }}>
                    <GoogleIcon />
                    {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
                  </button>
                  <p className="text-xs font-manrope text-center" style={{ color: "#6B4A3A" }}>O completa los datos manualmente abajo ↓</p>
                </div>
              ) : (
                <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-archivo text-base shrink-0" style={{ background: "#B0281B" }}>
                    {googleUser.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-archivo text-sm truncate" style={{ color: "#2A1810" }}>{googleUser.name}</p>
                    <p className="text-xs font-manrope truncate" style={{ color: "#6B4A3A" }}>{googleUser.email}</p>
                  </div>
                  <button onClick={logoutCliente} className="text-xs font-manrope transition-colors shrink-0" style={{ color: "#6B4A3A" }}>Salir</button>
                </div>
              )}

              {/* Datos de contacto */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <h3 className="font-manrope font-semibold text-sm" style={{ color: "#6B4A3A" }}>Datos de contacto</h3>
                <input type="text" placeholder="Tu nombre *" value={cliente.nombre}
                  onChange={e => setCliente({ ...cliente, nombre: e.target.value })}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors font-manrope"
                  style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} />
                <input type="tel" placeholder="Tu teléfono *" value={cliente.telefono}
                  onChange={e => setCliente({ ...cliente, telefono: e.target.value })}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors font-manrope"
                  style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} />
                <textarea placeholder="Notas (sin cebolla, extra salsa...)" value={cliente.notas}
                  onChange={e => setCliente({ ...cliente, notas: e.target.value })}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition-colors font-manrope"
                  style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} rows={2} />
                <select value={cliente.metodo_pago} onChange={e => setCliente({ ...cliente, metodo_pago: e.target.value })}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors font-manrope"
                  style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }}>
                  {/* <option value="efectivo">💵 Pago en Efectivo</option> */}
                  <option value="qr">📱 Pago QR / Transferencia</option>
                </select>
              </div>

              {/* Tipo de entrega */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <h3 className="font-manrope font-semibold text-sm" style={{ color: "#6B4A3A" }}>¿Cómo quieres tu pedido?</h3>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "local", icon: "🏪", label: "Recoger en local" },
                    { id: "mesa", icon: "🪑", label: "Para la mesa" },
                    { id: "delivery", icon: "🚗", label: "Delivery" },
                  ] as const).map(({ id, icon, label }) => (
                    <button key={id} onClick={() => setCliente(c => ({ ...c, tipo_entrega: id, metodo_pago: "qr" }))}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all active:scale-95 text-center font-manrope"
                      style={cliente.tipo_entrega === id
                        ? { background: "rgba(176,40,27,0.08)", border: "1px solid #B0281B", color: "#B0281B" }
                        : { background: "#F4EADB", border: "1px solid #E8DCC6", color: "#6B4A3A" }}>
                      <span className="text-2xl">{icon}</span>
                      <span className="text-xs font-semibold leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
                {cliente.tipo_entrega === "local" && (
                  <div className="space-y-2">
                    <p className="text-xs font-manrope" style={{ color: "#6B4A3A" }}>¿A qué hora pasarás a recoger?</p>
                    <div className="flex flex-wrap gap-2">
                      {generarSlots(config.hora_apertura, config.hora_cierre).map(slot => (
                        <button key={slot} type="button"
                          onClick={() => setCliente(c => ({ ...c, hora_recojo: slot }))}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 font-manrope"
                          style={cliente.hora_recojo === slot
                            ? { background: "#B0281B", color: "#FFFFFF" }
                            : { background: "#F4EADB", border: "1px solid #E8DCC6", color: "#6B4A3A" }}>
                          {slot}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-manrope" style={{ color: "#6B4A3A" }}>O escribe la hora:</span>
                      <input type="time"
                        onChange={e => { if (e.target.value) setCliente(c => ({ ...c, hora_recojo: e.target.value })) }}
                        className="rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-colors font-manrope"
                        style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} />
                    </div>
                  </div>
                )}
                {cliente.tipo_entrega === "mesa" && (
                  <input type="number" placeholder="Número de mesa *" value={cliente.numero_mesa}
                    onChange={e => setCliente({ ...cliente, numero_mesa: e.target.value })} min="1"
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors font-manrope"
                    style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} />
                )}
                {cliente.tipo_entrega === "delivery" && (
                  <div className="space-y-2">
                    {config.costo_envio > 0 && <p className="text-xs text-center font-manrope" style={{ color: "#6B4A3A" }}>Costo de envío: +Bs{config.costo_envio.toFixed(2)}</p>}
                    {cliente.latitud ? (
                      <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(63,143,67,0.08)", border: "1px solid rgba(63,143,67,0.3)" }}>
                        <span className="text-sm font-manrope font-medium" style={{ color: "#3F8F43" }}>✅ Ubicación capturada</span>
                        <div className="flex gap-3">
                          <a href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`} target="_blank" rel="noopener noreferrer" className="text-xs underline font-manrope" style={{ color: "#B0281B" }}>Ver mapa</a>
                          <button onClick={() => setCliente(c => ({ ...c, latitud: null, longitud: null }))} className="text-xs underline font-manrope" style={{ color: "#B0281B" }}>Quitar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={obtenerUbicacion} disabled={gpsLoading}
                        className="w-full text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-colors active:scale-95 font-manrope"
                        style={{ background: "#B0281B" }}>
                        {gpsLoading ? <><Spinner />Obteniendo...</> : "📍 Compartir mi ubicación GPS"}
                      </button>
                    )}
                    <input type="text" placeholder="Dirección o referencia" value={cliente.direccion}
                      onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors font-manrope"
                      style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} />
                  </div>
                )}
              </div>

              {/* Cupón */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <h3 className="font-manrope font-semibold text-sm" style={{ color: "#6B4A3A" }}>🎫 Cupón de descuento</h3>
                {cuponAplicado ? (
                  <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(63,143,67,0.08)", border: "1px solid rgba(63,143,67,0.3)" }}>
                    <span className="text-sm font-archivo" style={{ color: "#3F8F43" }}>✅ {cuponAplicado.codigo} — −Bs{cuponAplicado.descuento.toFixed(2)}</span>
                    <button onClick={() => { setCuponAplicado(null); setCuponInput("") }} className="text-xs underline font-manrope" style={{ color: "#B0281B" }}>Quitar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="CÓDIGO" value={cuponInput}
                      onChange={e => { setCuponInput(e.target.value.toUpperCase()); setCuponError("") }}
                      className="flex-1 rounded-xl px-4 py-3 text-sm font-mono uppercase focus:outline-none font-manrope"
                      style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }} />
                    <button onClick={validarCupon} disabled={validandoCupon || !cuponInput.trim()}
                      className="text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0 transition-colors font-manrope"
                      style={{ background: "#B0281B" }}>
                      {validandoCupon ? "..." : "Aplicar"}
                    </button>
                  </div>
                )}
                {cuponError && <p className="text-xs font-manrope" style={{ color: "#B0281B" }}>{cuponError}</p>}
              </div>

              <button onClick={() => setStep("confirmacion")}
                disabled={!cliente.nombre.trim() || !cliente.telefono.trim() || (cliente.tipo_entrega === "mesa" && !cliente.numero_mesa.trim())}
                className="w-full text-white py-4 rounded-2xl font-archivo text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed btn-3d"
                style={{ background: "#B0281B" }}>
                Continuar →
              </button>
            </>
          )}

          {/* ── STEP: Confirmación ── */}
          {step === "confirmacion" && (
            <>
              <div className="rounded-2xl p-4 space-y-2 text-sm" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <h3 className="font-manrope font-semibold mb-3" style={{ color: "#6B4A3A" }}>Datos del pedido</h3>
                {[
                  ["Nombre", cliente.nombre],
                  ["Teléfono", cliente.telefono],
                  ...(cliente.notas ? [["Notas", cliente.notas]] : []),
                  ["Pago", "QR / Transferencia"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between font-manrope">
                    <span style={{ color: "#6B4A3A" }}>{label}</span>
                    <span className="text-right max-w-[60%]" style={{ color: "#2A1810" }}>{value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-start font-manrope">
                  <span style={{ color: "#6B4A3A" }}>Entrega</span>
                  <div className="text-right" style={{ color: "#2A1810" }}>
                    {cliente.tipo_entrega === "local" && (
                      <div>
                        <span>🏪 Recoger en local</span>
                        <span className="text-xs block mt-0.5" style={{ color: "#6B4A3A" }}>⏰ {cliente.hora_recojo}</span>
                      </div>
                    )}
                    {cliente.tipo_entrega === "mesa" && <span>🪑 Mesa #{cliente.numero_mesa}</span>}
                    {cliente.tipo_entrega === "delivery" && (
                      <>
                        <span className="block">🚗 Delivery</span>
                        {cliente.latitud && <a href={`https://www.google.com/maps?q=${cliente.latitud},${cliente.longitud}`} target="_blank" rel="noopener noreferrer" className="underline text-xs block" style={{ color: "#B0281B" }}>📍 Ver en mapa</a>}
                        {cliente.direccion && <span className="text-xs block" style={{ color: "#6B4A3A" }}>{cliente.direccion}</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-4 space-y-2" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <h3 className="font-manrope font-semibold text-sm mb-3" style={{ color: "#6B4A3A" }}>Artículos</h3>
                {carrito.map(item => (
                  <div key={item.producto_id} className="flex justify-between text-sm font-manrope">
                    <span style={{ color: "#6B4A3A" }}>{item.cantidad}× {item.nombre}</span>
                    <span className="font-medium" style={{ color: "#2A1810" }}>Bs{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-1 space-y-1" style={{ borderTop: "1px solid #E8DCC6" }}>
                  {costoEnvio > 0 && <div className="flex justify-between text-sm font-manrope" style={{ color: "#6B4A3A" }}><span>Envío</span><span>+Bs{costoEnvio.toFixed(2)}</span></div>}
                  {descuento > 0 && <div className="flex justify-between text-sm font-manrope" style={{ color: "#3F8F43" }}><span>Descuento ({cuponAplicado?.codigo})</span><span>−Bs{descuento.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-archivo text-2xl pt-1" style={{ borderTop: "1px solid #E8DCC6", color: "#2A1810" }}>
                    <span>Total</span><span style={{ color: "#B0281B" }}>Bs{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {cliente.metodo_pago === "qr" && config.qr_pago_url && (
                <div className="rounded-2xl p-4 text-center space-y-3" style={{ background: "rgba(230,162,60,0.1)", border: "1px solid rgba(230,162,60,0.4)" }}>
                  <p className="font-manrope font-semibold text-sm" style={{ color: "#2A1810" }}>📱 Escanea y paga antes de confirmar</p>
                  <img src={config.qr_pago_url} alt="QR Pago" className="w-44 h-44 object-contain rounded-xl border border-yellow-800/30 bg-white mx-auto" />
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(config.qr_pago_url)
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `qr-pago-contryburger-${Date.now()}.png`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        window.URL.revokeObjectURL(url)
                      } catch (err) {
                        console.error('Error descargando QR:', err)
                        // Fallback: abrir en nueva pestaña
                        window.open(config.qr_pago_url, '_blank')
                      }
                    }}
                    className="text-sm text-blue-400 underline block hover:text-blue-300"
                  >
                    📥 Descargar QR
                  </button>
                  {config.instrucciones_pago && <p className="text-xs font-manrope" style={{ color: "#6B4A3A" }}>{config.instrucciones_pago}</p>}
                  <p className="font-archivo text-2xl" style={{ color: "#B0281B" }}>Monto: Bs{total.toFixed(2)}</p>
                  <p className="text-xs font-manrope" style={{ color: "#6B4A3A" }}>Una vez pagado, presiona el botón de abajo ↓</p>
                </div>
              )}

              {pedidoConfirmado ? (
                pedidoConfirmado.metodoPago === "qr" ? (
                  /* ── Pantalla: Esperando verificación QR ── */
                  <div className="space-y-4 animate-pop-in">
                    {/* Estado */}
                    <div className="bg-yellow-950/40 border border-yellow-700/50 rounded-2xl p-5 text-center space-y-2">
                      <div className="text-5xl">⏳</div>
                      <p className="text-yellow-300 font-black text-xl">Esperando verificación</p>
                      <p className="text-yellow-400/80 text-sm">Tu pedido fue recibido. Avísanos por WhatsApp para confirmar tu pago rápidamente.</p>
                      <div className="bg-yellow-900/30 border border-yellow-800/40 rounded-xl px-4 py-2 inline-block">
                        <p className="text-yellow-200 font-black text-2xl">Pedido #{pedidoConfirmado.orderId}</p>
                      </div>
                    </div>

                    {/* Resumen del pago */}
                    <div className="bg-gray-900 rounded-2xl p-4 space-y-2 text-sm">
                      <h3 className="font-semibold text-gray-300 text-xs uppercase tracking-wide mb-3">Resumen del pago</h3>
                      <div className="flex justify-between"><span className="text-gray-500">Cliente</span><span className="text-white font-medium">{pedidoConfirmado.nombreCliente}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Método</span><span className="text-white font-medium">📱 QR / Transferencia</span></div>
                      <div className="flex justify-between border-t border-gray-800 pt-2 mt-1"><span className="text-gray-400 font-semibold">Total pagado</span><span className="text-red-400 font-black text-lg">Bs{pedidoConfirmado.totalPagado.toFixed(2)}</span></div>
                    </div>

                    {/* Botón principal WhatsApp */}
                    {pedidoConfirmado.whatsappPhone ? (
                      <a
                        href={`https://wa.me/${pedidoConfirmado.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `💳 *PAGO REALIZADO*\n\nPedido #${pedidoConfirmado.orderId}\nCliente: ${pedidoConfirmado.nombreCliente}\nTotal: Bs${pedidoConfirmado.totalPagado.toFixed(2)}\n\nYa realicé el pago por QR, por favor verificar mi pedido 🙏`
                        )}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 active:scale-95 text-white py-4 rounded-2xl font-black text-base transition-all shadow-xl shadow-green-900/40 w-full">
                        <WhatsAppIcon className="w-6 h-6" />
                        Ya pagué · Confirmar por WhatsApp
                      </a>
                    ) : (
                      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center">
                        <p className="text-gray-400 text-sm">Muestra el pedido <span className="text-white font-black">#{pedidoConfirmado.orderId}</span> al cajero para confirmar tu pago.</p>
                      </div>
                    )}

                    {/* Botón secundario: ir al seguimiento */}
                    <button
                      onClick={() => router.push(`/menu/seguimiento?order=${encodeURIComponent(pedidoConfirmado.orderId)}`)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-2xl font-semibold text-sm transition-colors active:scale-95">
                      Ver estado del pedido →
                    </button>
                  </div>
                ) : (
                  /* ── Pantalla: Pedido confirmado (efectivo) ── */
                  <div className="bg-green-950/40 border border-green-800/50 rounded-2xl p-5 text-center space-y-3 animate-pop-in">
                    <div className="text-4xl">✅</div>
                    <p className="text-green-400 font-black text-lg">¡Pedido {pedidoConfirmado.orderId} confirmado!</p>
                    <p className="text-gray-400 text-sm">Redirigiendo al seguimiento...</p>
                    {pedidoConfirmado.whatsappPhone && (
                      <a href={`https://wa.me/${pedidoConfirmado.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola Contry Burger, soy el pedido ${pedidoConfirmado.orderId}. Mi nombre: ${pedidoConfirmado.nombreCliente}. Monto: Bs${pedidoConfirmado.totalPagado.toFixed(2)}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition-colors text-sm w-full">
                        <WhatsAppIcon className="w-5 h-5" />
                        Enviar confirmación por WhatsApp
                      </a>
                    )}
                  </div>
                )
              ) : (
                <button onClick={enviarPedido} disabled={enviando}
                  className="w-full text-white py-4 rounded-2xl font-archivo text-base transition-all active:scale-95 disabled:opacity-50 btn-3d"
                  style={{ background: "#B0281B" }}>
                  {enviando ? "Enviando pedido..." : cliente.metodo_pago === "qr" ? "✅ Ya transferí · Enviar pedido" : "🍔 Confirmar Pedido"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════════
     DESKTOP LAYOUT (≥ 1024px)
  ════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FBF5EC" }}>

        {/* PromoStrip Desktop */}
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 font-manrope text-xs font-semibold" style={{ background: "#2A1810", color: "#FBF5EC" }}>
          <span>🔥</span>
          <span>Las mejores hamburguesas de la ciudad · <span style={{ color: "#E6A23C", fontWeight: 800 }}>Pide ahora</span></span>
        </div>

        {/* Desktop Header */}
        <header className="sticky top-0 z-40 border-b" style={{ background: "rgba(251,245,236,0.97)", borderColor: "#E8DCC6", backdropFilter: "blur(8px)" }}>
          <div className="max-w-screen-xl mx-auto px-6 py-0 flex items-center gap-6 h-16">
            {/* Logo */}
            <div className="shrink-0 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-archivo text-lg" style={{ background: "#B0281B", color: "#E6A23C", boxShadow: "inset 0 -3px 0 #7A1A10" }}>C</div>
              <div className="leading-tight">
                <div className="font-archivo text-base leading-none" style={{ color: "#2A1810" }}>CONTRY</div>
                <div className="font-archivo text-xs tracking-[0.2em]" style={{ color: "#B0281B" }}>BURGUER</div>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex items-center gap-1 ml-4">
              {[
                { id: "inicio", label: "Inicio" },
                { id: "menu", label: "Menú" },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setActiveTab(id as Tab)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-manrope"
                  style={activeTab === id
                    ? { background: "#B0281B", color: "#FFFFFF" }
                    : { color: "#6B4A3A" }}>
                  {label}
                </button>
              ))}
              <a href="/menu/mis-pedidos" className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-manrope" style={{ color: "#6B4A3A" }}>
                Mis Pedidos
              </a>
            </nav>

            <div className="flex-1" />

            {/* WhatsApp */}
            {config.whatsapp_phone && (
              <a href={`https://wa.me/${config.whatsapp_phone.replace(/\D/g, "")}?text=Hola%20Contry%20Burger`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors font-manrope"
                style={{ background: "rgba(63,143,67,0.12)", border: "1px solid rgba(63,143,67,0.3)", color: "#3F8F43" }}>
                <WhatsAppIcon className="w-4 h-4" /> WhatsApp
              </a>
            )}

            {/* User */}
            {googleUser ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-archivo text-sm shrink-0" style={{ background: "#B0281B" }}>
                  {googleUser.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-sm max-w-[120px] truncate hidden xl:block font-manrope" style={{ color: "#2A1810" }}>{googleUser.name}</span>
                <button onClick={logoutCliente} className="text-xs font-manrope transition-colors" style={{ color: "#6B4A3A" }}>Salir</button>
              </div>
            ) : (
              <button onClick={loginConGoogle} disabled={googleLoading}
                className="flex items-center gap-2 font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-60 transition-all text-sm font-manrope"
                style={{ background: "#FFFFFF", color: "#2A1810", border: "1px solid #E8DCC6" }}>
                <GoogleIcon /> {googleLoading ? "..." : "Iniciar sesión"}
              </button>
            )}
          </div>

          {/* Category bar */}
          {activeTab === "menu" && (
            <div className="border-t" style={{ borderColor: "#E8DCC6" }}>
              <div className="max-w-screen-xl mx-auto px-6 flex gap-2 py-2 overflow-x-auto scrollbar-hide">
                {categorias.map(cat => (
                  <button key={cat} onClick={() => setCategoriaFiltro(cat)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all font-manrope"
                    style={categoriaFiltro === cat
                      ? { background: "#2A1810", color: "#FBF5EC" }
                      : { background: "#FFFFFF", color: "#6B4A3A", border: "1px solid #E8DCC6" }}>
                    {cat !== "Todos" ? `${getCatIcon(cat)} ` : ""}{cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Desktop main: content + cart sidebar */}
        <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-6 flex gap-6 items-start">

          {/* ── Content Area ── */}
          <main className="flex-1 min-w-0">

            {/* TAB: Inicio */}
            {activeTab === "inicio" && (
              <div className="space-y-8 animate-fade-in pb-6">
                {/* Hero */}
                <div className="rounded-3xl p-10 flex items-center gap-10" style={{ background: "#2A1810" }}>
                  <div className="flex-1">
                    <p className="font-manrope font-semibold text-sm mb-2 tracking-wider uppercase" style={{ color: "#E6A23C" }}>Bienvenido</p>
                    <h2 className="font-archivo text-5xl leading-tight mb-3" style={{ color: "#FBF5EC" }}>Contry<br />Burger</h2>
                    <p className="text-lg mb-6 font-manrope" style={{ color: "rgba(251,245,236,0.7)" }}>{config.mensaje_bienvenida || "Las mejores hamburguesas de la ciudad"}</p>
                    <button onClick={() => setActiveTab("menu")}
                      className="text-white px-8 py-3.5 rounded-2xl font-archivo text-lg transition-all hover:scale-105 btn-3d"
                      style={{ background: "#B0281B" }}>
                      Ver menú completo →
                    </button>
                  </div>
                  <div className="text-[120px] leading-none hidden lg:block">🍔</div>
                </div>

                {/* Info cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl p-6 text-center" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                    <p className="text-4xl mb-2">⏱</p>
                    <p className="font-archivo text-xl" style={{ color: "#2A1810" }}>{config.tiempo_estimado}</p>
                    <p className="font-manrope text-sm mt-1" style={{ color: "#6B4A3A" }}>Tiempo estimado</p>
                  </div>
                  <div className="rounded-2xl p-6 text-center" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                    <p className="text-4xl mb-2">🟢</p>
                    <p className="font-archivo text-xl" style={{ color: "#2A1810" }}>Abierto</p>
                    <p className="font-manrope text-sm mt-1" style={{ color: "#6B4A3A" }}>{config.hora_apertura} – {config.hora_cierre}</p>
                  </div>
                </div>

                {/* Category grid */}
                <div>
                  <h3 className="font-archivo text-xl mb-4" style={{ color: "#2A1810" }}>Explorar categorías</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {categorias.filter(c => c !== "Todos").map(cat => (
                      <button key={cat} onClick={() => { setCategoriaFiltro(cat); setActiveTab("menu") }}
                        className="rounded-2xl p-4 text-center transition-all hover:scale-105"
                        style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                        <div className="text-4xl mb-2">{getCatIcon(cat)}</div>
                        <p className="font-manrope text-sm font-semibold" style={{ color: "#2A1810" }}>{cat}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <SocialFooter config={config} />
              </div>
            )}

            {/* TAB: Menú */}
            {activeTab === "menu" && (
              <div className="animate-fade-in">
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                  {productosFiltrados.map(producto => {
                    const enCarrito = carrito.find(c => c.producto_id === producto.id)
                    const justAdded = addedId === producto.id
                    return (
                      <div key={producto.id}
                        className={`rounded-2xl overflow-hidden flex flex-col transition-all group ${producto.agotado ? "opacity-50" : "hover:-translate-y-0.5 hover:shadow-xl"} ${justAdded ? "ring-2" : ""}`}
                        style={{ background: "#FFFFFF", border: justAdded ? "2px solid #B0281B" : "1px solid #E8DCC6", boxShadow: justAdded ? undefined : undefined }}>
                        {/* Image */}
                        <div className="relative overflow-hidden cursor-pointer" onClick={() => abrirDetalle(producto)}>
                          {producto.imagen_url ? (
                            <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-40 flex items-center justify-center text-6xl group-hover:scale-110 transition-transform duration-300" style={{ background: "#F4EADB" }}>
                              {getCatIcon(producto.categoria)}
                            </div>
                          )}
                          {producto.agotado && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="text-white text-sm font-archivo px-4 py-1.5 rounded-full" style={{ background: "#B0281B" }}>Agotado</span>
                            </div>
                          )}
                          {enCarrito && !producto.agotado && (
                            <div className="absolute top-3 right-3 text-white text-xs font-archivo w-7 h-7 rounded-full flex items-center justify-center shadow-lg animate-pop-in" style={{ background: "#B0281B" }}>
                              {enCarrito.cantidad}
                            </div>
                          )}
                          <div className="absolute top-3 left-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-manrope font-medium" style={{ background: "rgba(251,245,236,0.92)", color: "#2A1810" }}>
                              {getCatIcon(producto.categoria)} {producto.categoria}
                            </span>
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="font-arquivo text-sm leading-tight mb-1 line-clamp-2 cursor-pointer transition-colors" style={{ color: "#2A1810" }} onClick={() => abrirDetalle(producto)}>{producto.nombre}</h3>
                          {producto.descripcion && (
                            <p className="text-xs leading-snug mb-2 line-clamp-2 font-manrope" style={{ color: "#6B4A3A" }}>{producto.descripcion}</p>
                          )}
                          <p className="font-arquivo text-2xl mb-4" style={{ color: "#B0281B" }}>Bs{producto.precio_venta.toFixed(2)}</p>
                          {producto.agotado ? (
                            <div className="mt-auto text-sm text-center py-2.5 rounded-xl font-manrope font-medium" style={{ background: "#F4EADB", color: "#6B4A3A" }}>Agotado hoy</div>
                          ) : enCarrito ? (
                            <div className="flex items-center justify-between mt-auto rounded-full p-1" style={{ background: "#B0281B" }}>
                              <button onClick={() => cambiarCantidad(producto.id, -1)}
                                className="w-9 h-9 rounded-full font-arquivo text-white flex items-center justify-center transition-colors text-lg" style={{ background: "transparent" }}>−</button>
                              <span className="font-arquivo text-white text-lg">{enCarrito.cantidad}</span>
                              <button onClick={() => cambiarCantidad(producto.id, 1)}
                                className="w-9 h-9 rounded-full font-arquivo text-white flex items-center justify-center transition-colors text-lg" style={{ background: "transparent" }}>+</button>
                            </div>
                          ) : (
                            <button onClick={() => agregarAlCarrito(producto)}
                              className="mt-auto text-white py-2.5 rounded-full text-sm font-arquivo transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1 btn-3d"
                              style={{ background: "#B0281B" }}>
                              <span className="text-lg leading-none">+</span> AGREGAR
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </main>

          {/* ── Desktop Cart Sidebar ── */}
          <aside className="w-80 xl:w-96 shrink-0 sticky top-28">
            <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: "#F4EADB", borderBottom: "1px solid #E8DCC6" }}>
                <h2 className="font-archivo text-lg" style={{ color: "#2A1810" }}>Tu pedido</h2>
                {totalItems > 0 && (
                  <span className="text-white text-xs font-archivo px-2 py-0.5 rounded-full" style={{ background: "#B0281B" }}>{totalItems}</span>
                )}
              </div>

              {carrito.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-4xl mb-3">🛒</p>
                  <p className="font-manrope text-sm" style={{ color: "#6B4A3A" }}>Tu carrito está vacío</p>
                  <p className="font-manrope text-xs mt-1" style={{ color: "#6B4A3A", opacity: 0.7 }}>Agrega productos del menú</p>
                </div>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto p-4 space-y-2">
                    {carrito.map(item => (
                      <div key={item.producto_id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: "#F4EADB" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-manrope font-semibold text-xs truncate" style={{ color: "#2A1810" }}>{item.nombre}</p>
                          <p className="font-archivo text-sm" style={{ color: "#B0281B" }}>Bs{item.subtotal.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 rounded-full p-0.5" style={{ background: "#B0281B" }}>
                          <button onClick={() => cambiarCantidad(item.producto_id, -1)}
                            className="w-6 h-6 rounded-full font-archivo text-white flex items-center justify-center text-sm" style={{ background: "transparent" }}>−</button>
                          <span className="font-archivo text-white text-xs w-4 text-center">{item.cantidad}</span>
                          <button onClick={() => cambiarCantidad(item.producto_id, 1)}
                            className="w-6 h-6 rounded-full font-archivo text-white flex items-center justify-center text-sm" style={{ background: "transparent" }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 space-y-3" style={{ borderTop: "1px solid #E8DCC6" }}>
                    <div className="flex justify-between items-center">
                      <span className="font-manrope text-sm" style={{ color: "#6B4A3A" }}>Subtotal</span>
                      <span className="font-archivo text-xl" style={{ color: "#2A1810" }}>Bs{subtotalProductos.toFixed(2)}</span>
                    </div>
                    {config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo && (
                      <p className="text-xs text-center rounded-lg px-3 py-2 font-manrope" style={{ background: "rgba(230,162,60,0.1)", border: "1px solid rgba(230,162,60,0.3)", color: "#6B4A3A" }}>
                        Mínimo: Bs{config.pedido_minimo.toFixed(2)} · Falta Bs{(config.pedido_minimo - subtotalProductos).toFixed(2)}
                      </p>
                    )}
                    <button onClick={() => setStep("datos")}
                      disabled={config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo}
                      className="w-full text-white py-3.5 rounded-xl font-archivo text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed btn-3d"
                      style={{ background: "#B0281B" }}>
                      HACER PEDIDO · Bs{subtotalProductos.toFixed(2)}
                    </button>
                  </div>
                </>
              )}

              {!googleUser && (
                <div className="p-4 space-y-2" style={{ borderTop: "1px solid #E8DCC6" }}>
                  <p className="text-xs font-manrope text-center font-medium" style={{ color: "#6B4A3A" }}>¿Tienes cuenta?</p>
                  <button onClick={loginConGoogle} disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-60 transition-all text-sm font-manrope"
                    style={{ background: "#FFFFFF", color: "#2A1810", border: "1px solid #E8DCC6" }}>
                    <GoogleIcon /> {googleLoading ? "..." : "Iniciar sesión con Google"}
                  </button>
                </div>
              )}

              {googleUser && (
                <div className="p-3 flex items-center gap-2" style={{ borderTop: "1px solid #E8DCC6" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-archivo text-xs shrink-0" style={{ background: "#B0281B" }}>
                    {googleUser.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="text-xs font-manrope flex-1 truncate" style={{ color: "#6B4A3A" }}>{googleUser.name}</span>
                  <button onClick={logoutCliente} className="text-xs font-manrope" style={{ color: "#6B4A3A" }}>Salir</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════════════════
     MOBILE LAYOUT (< 1024px)
  ════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FBF5EC" }}>

      {/* PromoStrip Mobile */}
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 font-manrope text-xs font-semibold" style={{ background: "#2A1810", color: "#FBF5EC" }}>
        <span>🔥</span>
        <span>{config.mensaje_bienvenida || <span>Pide ahora · <span style={{ color: "#E6A23C", fontWeight: 800 }}>Las mejores burgers</span></span>}</span>
      </div>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: "rgba(251,245,236,0.97)", borderColor: "#E8DCC6" }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-archivo text-sm" style={{ background: "#B0281B", color: "#E6A23C", boxShadow: "inset 0 -2px 0 #7A1A10" }}>C</div>
            <div className="leading-tight">
              <div className="font-archivo text-sm leading-none" style={{ color: "#2A1810" }}>CONTRY</div>
              <div className="font-archivo text-[9px] tracking-[0.2em]" style={{ color: "#B0281B" }}>BURGUER</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-manrope text-xs" style={{ color: "#6B4A3A" }}>⏱ {config.tiempo_estimado}</span>
            {config.whatsapp_phone && (
              <a href={`https://wa.me/${config.whatsapp_phone.replace(/\D/g, "")}?text=Hola%20Contry%20Burger`}
                target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(63,143,67,0.12)", border: "1px solid rgba(63,143,67,0.3)" }}>
                <WhatsAppIcon className="w-4 h-4 text-[#3F8F43]" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Main */}
      <main className="flex-1 pb-24">

        {/* TAB: Inicio */}
        {activeTab === "inicio" && (
          <div className="px-4 py-5 space-y-5 animate-fade-in">
            <div className="rounded-3xl p-6 text-center" style={{ background: "#2A1810" }}>
              <div className="text-6xl mb-3">🍔</div>
              <h2 className="font-archivo text-2xl leading-tight mb-2" style={{ color: "#FBF5EC" }}>Bienvenido a<br />Contry Burger</h2>
              <p className="font-manrope text-sm mt-2 mb-4" style={{ color: "rgba(251,245,236,0.7)" }}>{config.mensaje_bienvenida || "Las mejores hamburguesas de la ciudad"}</p>
              <button onClick={() => setActiveTab("menu")}
                className="text-white px-8 py-3 rounded-2xl font-archivo transition-all active:scale-95 btn-3d"
                style={{ background: "#B0281B" }}>
                Ver menú →
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-2xl p-4 text-center" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                <p className="text-2xl mb-1">⏱</p>
                <p className="font-archivo text-sm" style={{ color: "#2A1810" }}>{config.tiempo_estimado}</p>
                <p className="font-manrope text-xs" style={{ color: "#6B4A3A" }}>Tiempo estimado</p>
              </div>
              {config.pedido_minimo > 0 && (
                <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(230,162,60,0.1)", border: "1px solid rgba(230,162,60,0.3)" }}>
                  <p className="font-manrope text-sm font-medium" style={{ color: "#2A1810" }}>Pedido mínimo: Bs{config.pedido_minimo.toFixed(2)}</p>
                </div>
              )}
            </div>
            <div>
              <p className="font-archivo mb-3 text-sm" style={{ color: "#2A1810" }}>Explorar categorías</p>
              <div className="grid grid-cols-3 gap-2.5">
                {categorias.filter(c => c !== "Todos").map(cat => (
                  <button key={cat} onClick={() => { setCategoriaFiltro(cat); setActiveTab("menu") }}
                    className="rounded-2xl p-3.5 text-center transition-all active:scale-95"
                    style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                    <div className="text-2xl mb-1">{getCatIcon(cat)}</div>
                    <p className="font-manrope text-xs font-medium leading-tight" style={{ color: "#2A1810" }}>{cat}</p>
                  </button>
                ))}
              </div>
            </div>
            <SocialFooter config={config} />
          </div>
        )}

        {/* TAB: Menú */}
        {activeTab === "menu" && (
          <div className="animate-fade-in">
            {/* Category chips sticky */}
            <div className="sticky top-[73px] z-10 border-b pt-2" style={{ background: "rgba(251,245,236,0.97)", borderColor: "#E8DCC6", backdropFilter: "blur(8px)" }}>
              <div className="flex gap-2 overflow-x-auto pb-3 px-3 scrollbar-hide">
                {categorias.map(cat => (
                  <button key={cat} onClick={() => setCategoriaFiltro(cat)}
                    className="px-4 py-2 rounded-full text-sm font-manrope font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95 flex items-center gap-1.5"
                    style={categoriaFiltro === cat
                      ? { background: "#2A1810", color: "#FBF5EC", border: "1px solid #2A1810" }
                      : { background: "#FFFFFF", color: "#6B4A3A", border: "1px solid #E8DCC6" }}>
                    {cat !== "Todos" ? <span className="text-sm">{getCatIcon(cat)}</span> : null}{cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 py-3 grid grid-cols-2 gap-3">
              {productosFiltrados.map(producto => {
                const enCarrito = carrito.find(c => c.producto_id === producto.id)
                const justAdded = addedId === producto.id
                return (
                  <div key={producto.id}
                    className={`rounded-2xl overflow-hidden flex flex-col transition-all ${producto.agotado ? "opacity-50" : ""} ${justAdded ? "scale-[1.02]" : ""}`}
                    style={{ background: "#FFFFFF", border: justAdded ? "2px solid #B0281B" : "1px solid #E8DCC6" }}>
                    <div className="relative cursor-pointer" onClick={() => abrirDetalle(producto)}>
                      {producto.imagen_url ? (
                        <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-36 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center text-5xl" style={{ background: "#F4EADB" }}>
                          {getCatIcon(producto.categoria)}
                        </div>
                      )}
                      {producto.agotado && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-xs font-archivo px-3 py-1 rounded-full" style={{ background: "#B0281B" }}>Agotado</span>
                        </div>
                      )}
                      {enCarrito && !producto.agotado && (
                        <div className="absolute top-2 right-2 text-white text-xs font-archivo w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-pop-in" style={{ background: "#B0281B" }}>
                          {enCarrito.cantidad}
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-archivo text-sm leading-tight mb-1 cursor-pointer" style={{ color: "#2A1810" }} onClick={() => abrirDetalle(producto)}>{producto.nombre}</h3>
                      {producto.descripcion && (
                        <p className="font-manrope text-xs leading-snug mb-2 line-clamp-2" style={{ color: "#6B4A3A" }}>{producto.descripcion}</p>
                      )}
                      <p className="font-archivo text-xl mb-3" style={{ color: "#B0281B" }}>Bs{producto.precio_venta.toFixed(2)}</p>
                      {producto.agotado ? (
                        <div className="mt-auto text-xs text-center py-2 rounded-xl font-manrope" style={{ background: "#F4EADB", color: "#6B4A3A" }}>Agotado hoy</div>
                      ) : enCarrito ? (
                        <div className="flex items-center justify-between mt-auto rounded-full p-1" style={{ background: "#B0281B" }}>
                          <button onClick={() => cambiarCantidad(producto.id, -1)}
                            className="w-8 h-8 rounded-full font-archivo text-white flex items-center justify-center text-base" style={{ background: "transparent" }}>−</button>
                          <span className="font-archivo text-white text-base">{enCarrito.cantidad}</span>
                          <button onClick={() => cambiarCantidad(producto.id, 1)}
                            className="w-8 h-8 rounded-full font-archivo text-white flex items-center justify-center text-base" style={{ background: "transparent" }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => agregarAlCarrito(producto)}
                          className="mt-auto text-white py-2.5 rounded-full text-xs font-archivo transition-all active:scale-95 flex items-center justify-center gap-1 btn-3d"
                          style={{ background: "#B0281B" }}>
                          + AGREGAR
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
                <div className="rounded-2xl p-6 text-center" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-archivo text-2xl mx-auto mb-3 shadow-lg" style={{ background: "#B0281B" }}>
                    {googleUser.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <h2 className="font-archivo text-lg" style={{ color: "#2A1810" }}>{googleUser.name}</h2>
                  <p className="font-manrope text-sm" style={{ color: "#6B4A3A" }}>{googleUser.email}</p>
                </div>
                <a href="/menu/mis-pedidos"
                  className="flex items-center justify-between rounded-2xl p-4 transition-colors"
                  style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="font-archivo text-sm" style={{ color: "#2A1810" }}>Mis Pedidos</p>
                      <p className="font-manrope text-xs" style={{ color: "#6B4A3A" }}>Ver historial completo</p>
                    </div>
                  </div>
                  <span className="text-xl" style={{ color: "#6B4A3A" }}>›</span>
                </a>
                <button onClick={logoutCliente}
                  className="w-full py-3 rounded-2xl font-manrope font-semibold transition-colors text-sm active:scale-95"
                  style={{ background: "#FFFFFF", border: "1px solid #E8DCC6", color: "#B0281B" }}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl p-6 text-center" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                  <div className="text-5xl mb-3">👤</div>
                  <h2 className="font-archivo text-lg mb-1" style={{ color: "#2A1810" }}>Inicia sesión</h2>
                  <p className="font-manrope text-sm" style={{ color: "#6B4A3A" }}>Disfruta una mejor experiencia</p>
                </div>
                <div className="rounded-2xl p-4 space-y-2.5" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                  {["Guarda tus datos automáticamente", "Pedidos más rápidos la próxima vez", "Acceso a ofertas y cupones exclusivos", "Historial completo de tus pedidos"].map(b => (
                    <div key={b} className="flex items-center gap-3 text-sm font-manrope">
                      <span className="font-bold text-base" style={{ color: "#3F8F43" }}>✓</span>
                      <span style={{ color: "#2A1810" }}>{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={loginConGoogle} disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 font-semibold py-3.5 rounded-2xl hover:bg-gray-50 disabled:opacity-60 transition-all active:scale-95 font-manrope"
                  style={{ background: "#FFFFFF", color: "#2A1810", border: "1px solid #E8DCC6" }}>
                  <GoogleIcon />
                  {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Banner instalar PWA */}
      {!isInstalled && !installDismissed && installPrompt && (
        <div className="fixed bottom-16 left-3 right-3 z-40 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl animate-slide-up" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
          <div className="text-3xl shrink-0">📲</div>
          <div className="flex-1 min-w-0">
            <p className="font-archivo text-sm leading-none" style={{ color: "#2A1810" }}>Instala la app</p>
            <p className="font-manrope text-xs mt-0.5" style={{ color: "#6B4A3A" }}>Accede rápido desde tu pantalla de inicio</p>
          </div>
          <button onClick={instalarApp}
            className="text-white px-3 py-1.5 rounded-xl text-xs font-archivo shrink-0 transition-colors"
            style={{ background: "#B0281B" }}>
            Instalar
          </button>
          <button onClick={dismissInstall} className="text-lg leading-none shrink-0" style={{ color: "#6B4A3A" }}>×</button>
        </div>
      )}

      {/* Mobile Bottom Sheet Carrito */}
      {carritoOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setCarritoOpen(false)} />
          <div className="relative rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl animate-slide-up" style={{ background: "#FBF5EC", borderTop: "1px solid #E8DCC6" }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "#E8DCC6" }} />
            </div>
            {/* Header */}
            <div className="px-5 pb-2 flex items-center justify-between shrink-0">
              <h2 className="font-archivo text-lg" style={{ color: "#2A1810" }}>Tu carrito</h2>
              <button onClick={() => setCarritoOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none"
                style={{ background: "#FFFFFF", border: "1px solid #E8DCC6", color: "#6B4A3A" }}>×</button>
            </div>

            {/* Tabs */}
            <div className="px-5 pb-2 shrink-0">
              <div className="flex rounded-xl p-1 gap-1" style={{ background: "#F4EADB" }}>
                <button onClick={() => setCarritoTab("pedido")}
                  className="flex-1 py-2 rounded-lg text-sm font-manrope font-bold transition-colors"
                  style={carritoTab === "pedido"
                    ? { background: "#FFFFFF", color: "#2A1810" }
                    : { background: "transparent", color: "#6B4A3A" }}>
                  🛒 Mi pedido {totalItems > 0 && <span className="ml-1 text-white text-xs px-1.5 py-0.5 rounded-full font-archivo" style={{ background: "#B0281B" }}>{totalItems}</span>}
                </button>
                <button onClick={() => setCarritoTab("extras")}
                  className="flex-1 py-2 rounded-lg text-sm font-manrope font-bold transition-colors flex items-center justify-center gap-1.5"
                  style={carritoTab === "extras"
                    ? { background: "#B0281B", color: "#FFFFFF" }
                    : { background: "transparent", color: "#6B4A3A" }}>
                  ✨ Extras {productosExtra.length > 0 && carritoTab !== "extras" && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#B0281B" }} />}
                </button>
              </div>
            </div>

            {/* Contenido tab Mi pedido */}
            {carritoTab === "pedido" && (
              <>
                <div className="overflow-y-auto flex-1 px-5 space-y-2 pb-3">
                  {carrito.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-5xl mb-3">🛒</p>
                      <p className="font-manrope mb-4" style={{ color: "#6B4A3A" }}>Tu carrito está vacío</p>
                      <button onClick={() => { setCarritoOpen(false); setActiveTab("menu") }}
                        className="text-white px-6 py-2.5 rounded-xl font-archivo text-sm btn-3d"
                        style={{ background: "#B0281B" }}>
                        Explorar menú
                      </button>
                    </div>
                  ) : (
                    carrito.map(item => (
                      <div key={item.producto_id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-archivo text-sm truncate" style={{ color: "#2A1810" }}>{item.nombre}</p>
                          <p className="font-archivo text-sm" style={{ color: "#B0281B" }}>Bs{item.subtotal.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 rounded-full p-1" style={{ background: "#B0281B" }}>
                          <button onClick={() => cambiarCantidad(item.producto_id, -1)}
                            className="w-7 h-7 rounded-full font-archivo text-white flex items-center justify-center text-base" style={{ background: "transparent" }}>−</button>
                          <span className="font-archivo text-white text-sm w-5 text-center">{item.cantidad}</span>
                          <button onClick={() => cambiarCantidad(item.producto_id, 1)}
                            className="w-7 h-7 rounded-full font-archivo text-white flex items-center justify-center text-base" style={{ background: "transparent" }}>+</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {carrito.length > 0 && (
                  <div className="px-5 pb-6 pt-3 space-y-3 shrink-0 safe-area-pb" style={{ borderTop: "1px solid #E8DCC6" }}>
                    <div className="flex justify-between items-center">
                      <span className="font-manrope text-sm" style={{ color: "#6B4A3A" }}>{totalItems} artículo{totalItems !== 1 ? "s" : ""}</span>
                      <span className="font-archivo text-2xl" style={{ color: "#2A1810" }}>Bs{subtotalProductos.toFixed(2)}</span>
                    </div>
                    {config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo && (
                      <p className="font-manrope text-xs text-center" style={{ color: "#6B4A3A" }}>Mínimo: Bs{config.pedido_minimo.toFixed(2)} · Falta Bs{(config.pedido_minimo - subtotalProductos).toFixed(2)}</p>
                    )}
                    <button onClick={() => { setCarritoOpen(false); setStep("datos") }}
                      disabled={config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo}
                      className="w-full text-white py-4 rounded-2xl font-archivo text-base transition-all active:scale-95 disabled:opacity-40 btn-3d flex items-center justify-between px-5"
                      style={{ background: "#2A1810" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center font-archivo text-sm" style={{ background: "#B0281B" }}>{totalItems}</div>
                        <span>COMPLETAR PEDIDO</span>
                      </div>
                      <span className="font-archivo" style={{ color: "#E6A23C" }}>Bs{subtotalProductos.toFixed(2)}</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Contenido tab Extras */}
            {carritoTab === "extras" && (
              <>
                <div className="overflow-y-auto flex-1 px-4 pb-3">
                  {productosExtra.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-4xl mb-3">✨</p>
                      <p className="font-manrope text-sm" style={{ color: "#6B4A3A" }}>No hay extras configurados</p>
                      <p className="font-manrope text-xs mt-1" style={{ color: "#6B4A3A", opacity: 0.7 }}>El admin puede marcar categorías como Extra en Configuración</p>
                    </div>
                  ) : (
                    <>
                      {categoriasExtra.map(cat => {
                        const prods = productosExtra.filter(p => p.categoria === cat)
                        if (prods.length === 0) return null
                        return (
                          <div key={cat} className="mb-4">
                            <p className="font-archivo text-xs uppercase tracking-wide mb-2 mt-3" style={{ color: "#6B4A3A" }}>
                              {getCatIcon(cat)} {cat}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {prods.map(prod => {
                                const enCarrito = carrito.find(c => c.producto_id === prod.id)
                                return (
                                  <div key={prod.id} className="rounded-2xl p-3 flex flex-col" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6" }}>
                                    {prod.imagen_url ? (
                                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-20 object-cover rounded-xl mb-2" />
                                    ) : (
                                      <div className="w-full h-16 rounded-xl mb-2 flex items-center justify-center text-3xl" style={{ background: "#F4EADB" }}>
                                        {getCatIcon(prod.categoria)}
                                      </div>
                                    )}
                                    <p className="font-archivo text-xs leading-tight line-clamp-2 flex-1" style={{ color: "#2A1810" }}>{prod.nombre}</p>
                                    <p className="font-archivo text-sm mt-1 mb-2" style={{ color: "#B0281B" }}>Bs{prod.precio_venta.toFixed(2)}</p>
                                    {enCarrito ? (
                                      <div className="flex items-center justify-between rounded-full p-1" style={{ background: "#B0281B" }}>
                                        <button onClick={() => cambiarCantidad(prod.id, -1)}
                                          className="w-7 h-7 rounded-full font-archivo text-white flex items-center justify-center text-sm" style={{ background: "transparent" }}>−</button>
                                        <span className="font-archivo text-white text-sm">{enCarrito.cantidad}</span>
                                        <button onClick={() => cambiarCantidad(prod.id, 1)}
                                          className="w-7 h-7 rounded-full font-archivo text-white flex items-center justify-center text-sm" style={{ background: "transparent" }}>+</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => agregarAlCarrito(prod)}
                                        className="w-full text-white py-1.5 rounded-full text-xs font-archivo transition-colors active:scale-95 btn-3d"
                                        style={{ background: "#B0281B" }}>
                                        + AGREGAR
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
                {carrito.length > 0 && (
                  <div className="px-5 pb-6 pt-3 shrink-0 safe-area-pb" style={{ borderTop: "1px solid #E8DCC6" }}>
                    <button onClick={() => { setCarritoOpen(false); setStep("datos") }}
                      disabled={config.pedido_minimo > 0 && subtotalProductos < config.pedido_minimo}
                      className="w-full text-white py-4 rounded-2xl font-archivo text-base transition-all active:scale-95 disabled:opacity-40 btn-3d"
                      style={{ background: "#B0281B" }}>
                      HACER PEDIDO · Bs{subtotalProductos.toFixed(2)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Vista Detalle Producto */}
      {detalleProducto && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDetalleProducto(null)} />
          <div className="relative w-full lg:max-w-lg lg:rounded-2xl rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden" style={{ background: "#FBF5EC" }}>
            {/* Handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "#E8DCC6" }} />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">
              {detalleProducto.imagen_url ? (
                <div className="relative">
                  <img src={detalleProducto.imagen_url} alt={detalleProducto.nombre} className="w-full h-56 lg:h-64 object-cover" />
                  {detalleProducto.agotado && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-sm font-archivo px-4 py-1.5 rounded-full" style={{ background: "#B0281B" }}>Agotado</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-44 lg:h-52 flex items-center justify-center text-7xl" style={{ background: "#F4EADB" }}>
                  {getCatIcon(detalleProducto.categoria)}
                </div>
              )}

              <button onClick={() => setDetalleProducto(null)}
                className="absolute top-3 right-3 lg:top-4 lg:right-4 w-8 h-8 rounded-full flex items-center justify-center text-xl transition-colors backdrop-blur-sm"
                style={{ background: "rgba(251,245,236,0.9)", color: "#2A1810", border: "1px solid #E8DCC6" }}>
                ×
              </button>

              <div className="px-5 pt-4 pb-2 space-y-3">
                <span className="inline-block text-xs px-2.5 py-1 rounded-full font-manrope font-medium" style={{ background: "#F4EADB", color: "#6B4A3A" }}>
                  {getCatIcon(detalleProducto.categoria)} {detalleProducto.categoria}
                </span>
                <div>
                  <h2 className="font-archivo text-xl lg:text-2xl leading-tight" style={{ color: "#2A1810" }}>{detalleProducto.nombre}</h2>
                  <p className="font-archivo text-2xl lg:text-3xl mt-1" style={{ color: "#B0281B" }}>Bs{detalleProducto.precio_venta.toFixed(2)}</p>
                </div>
                {detalleProducto.descripcion && (
                  <p className="font-manrope text-sm leading-relaxed" style={{ color: "#6B4A3A" }}>{detalleProducto.descripcion}</p>
                )}
                {recetasDetalle.length > 0 && (
                  <div>
                    <h3 className="font-archivo text-xs uppercase tracking-wide mb-2" style={{ color: "#6B4A3A" }}>Ingredientes</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {recetasDetalle.map((r, i) => (
                        <span key={i} className="font-manrope text-xs px-2.5 py-1 rounded-full" style={{ background: "#FFFFFF", border: "1px solid #E8DCC6", color: "#6B4A3A" }}>
                          {r.ingrediente_nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!detalleProducto.agotado && (
              <div className="px-5 pb-6 pt-3 shrink-0 safe-area-pb space-y-3" style={{ borderTop: "1px solid #E8DCC6" }}>
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setDetalleCantidad(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl font-archivo flex items-center justify-center transition-colors text-xl"
                    style={{ background: "#F4EADB", border: "1px solid #E8DCC6", color: "#2A1810" }}>−</button>
                  <span className="font-archivo text-2xl w-10 text-center" style={{ color: "#2A1810" }}>{detalleCantidad}</span>
                  <button onClick={() => setDetalleCantidad(q => q + 1)}
                    className="w-10 h-10 rounded-xl font-archivo text-white flex items-center justify-center transition-colors text-xl"
                    style={{ background: "#B0281B" }}>+</button>
                </div>
                <button onClick={agregarDesdeDetalle}
                  className="w-full text-white py-3.5 rounded-2xl font-archivo text-base transition-all active:scale-95 btn-3d flex items-center justify-center gap-2"
                  style={{ background: "#B0281B" }}>
                  AGREGAR · Bs{(detalleProducto.precio_venta * detalleCantidad).toFixed(2)}
                </button>
              </div>
            )}

            {detalleProducto.agotado && (
              <div className="px-5 pb-6 pt-3 shrink-0 safe-area-pb" style={{ borderTop: "1px solid #E8DCC6" }}>
                <div className="text-center py-3 rounded-2xl font-manrope font-semibold" style={{ background: "#F4EADB", color: "#6B4A3A" }}>Agotado hoy</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t safe-area-pb" style={{ background: "rgba(251,245,236,0.97)", borderColor: "#E8DCC6" }}>
        <div className="flex items-stretch">
          {([
            { id: "inicio", label: "Inicio", Icon: HomeIcon, badge: 0 },
            { id: "menu", label: "Menú", Icon: MenuIcon2, badge: 0 },
            { id: "carrito", label: "Carrito", Icon: CartIcon, badge: totalItems },
            { id: "perfil", label: "Perfil", Icon: ProfileIcon, badge: 0 },
          ] as const).map(({ id, label, Icon, badge }) => {
            const isActive = id === "carrito" ? carritoOpen : activeTab === id
            return (
              <button key={id}
                onClick={() => {
                  if (id === "carrito") setCarritoOpen(o => !o)
                  else { setCarritoOpen(false); setActiveTab(id as Tab) }
                }}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors"
                style={{ color: isActive ? "#B0281B" : "#6B4A3A" }}>
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 text-white text-xs font-archivo min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center leading-none" style={{ background: "#B0281B" }}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-manrope font-semibold">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/* ─── Social Footer ─── */
function SocialFooter({ config }: { config: { redes_sociales: RedSocial[]; direccion_local: string; whatsapp_phone: string } }) {
  const redes = config.redes_sociales || []
  if (!config.direccion_local && redes.length === 0 && !config.whatsapp_phone) return null
  return (
    <div className="mt-6 pt-5 pb-2 text-center space-y-3" style={{ borderTop: "1px solid #E8DCC6" }}>
      {config.direccion_local && (
        <p className="font-manrope text-xs flex items-center justify-center gap-1.5" style={{ color: "#6B4A3A" }}>
          <span>📍</span> {config.direccion_local}
        </p>
      )}
      {(redes.length > 0 || config.whatsapp_phone) && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {config.whatsapp_phone && (
            <a href={`https://wa.me/${config.whatsapp_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-green-600/20 border border-green-700/30 flex items-center justify-center hover:bg-green-600/40 transition-colors">
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          )}
          {redes.map((red, i) => {
            const info = SOCIAL_ICONS[red.plataforma]
            if (!info) return null
            return (
              <a key={i} href={red.url} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700/50 flex items-center justify-center hover:bg-gray-700 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={info.color}><path d={info.icon} /></svg>
              </a>
            )
          })}
        </div>
      )}
      <p className="font-manrope text-xs" style={{ color: "#6B4A3A", opacity: 0.6 }}>Contry Burger · {new Date().getFullYear()}</p>
    </div>
  )
}

/* ─── Icons ─── */
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
