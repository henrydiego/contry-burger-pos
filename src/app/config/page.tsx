"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

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
  whatsapp_phone: string
}

interface Categoria {
  id: number
  nombre: string
  icono: string
  orden: number
  activo: boolean
}

interface Cupon {
  id: number
  codigo: string
  tipo: string
  valor: number
  usos_max: number
  usos_actuales: number
  activo: boolean
  fecha_vencimiento: string | null
}

const DEFAULT: Config = {
  qr_pago_url: "",
  instrucciones_pago: "Escanea el QR con tu app de Yape o BCP y envía el monto exacto.",
  hora_apertura: "09:00",
  hora_cierre: "22:00",
  abierto: true,
  tiempo_estimado: "30-45 min",
  costo_envio: 0,
  pedido_minimo: 0,
  mensaje_bienvenida: "¡Bienvenido! Haz tu pedido y te lo llevamos.",
  whatsapp_phone: "",
}

export default function ConfigPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState("")
  const [tab, setTab] = useState<"tienda" | "delivery" | "whatsapp" | "cupones" | "categorias">("tienda")
  const fileRef = useRef<HTMLInputElement>(null)

  // Cupones
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [nuevoCupon, setNuevoCupon] = useState({ codigo: "", tipo: "porcentaje", valor: "", usos_max: "100", fecha_vencimiento: "" })
  const [savingCupon, setSavingCupon] = useState(false)

  // Categorías
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [nuevaCat, setNuevaCat] = useState({ nombre: "", icono: "🍽️" })
  const [savingCat, setSavingCat] = useState(false)

  useEffect(() => {
    loadConfig()
    loadCupones()
    loadCategorias()
  }, [])

  async function loadConfig() {
    const { data } = await supabase.from("configuracion").select("*").eq("id", 1).single()
    if (data) setCfg({ ...DEFAULT, ...data })
  }

  async function loadCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("orden")
    setCategorias(data || [])
  }

  async function moverCategoria(id: number, direccion: "arriba" | "abajo") {
    const idx = categorias.findIndex(c => c.id === id)
    const otro = direccion === "arriba" ? categorias[idx - 1] : categorias[idx + 1]
    if (!otro) return
    const cat = categorias[idx]
    await Promise.all([
      supabase.from("categorias").update({ orden: otro.orden }).eq("id", cat.id),
      supabase.from("categorias").update({ orden: cat.orden }).eq("id", otro.id),
    ])
    loadCategorias()
  }

  async function toggleCategoria(id: number, activo: boolean) {
    await supabase.from("categorias").update({ activo: !activo }).eq("id", id)
    loadCategorias()
  }

  async function actualizarIcono(id: number, icono: string) {
    await supabase.from("categorias").update({ icono }).eq("id", id)
    loadCategorias()
  }

  async function eliminarCategoria(id: number, nombre: string) {
    if (!confirm(`¿Eliminar categoría "${nombre}"?`)) return
    await supabase.from("categorias").delete().eq("id", id)
    loadCategorias()
  }

  async function agregarCategoria() {
    if (!nuevaCat.nombre.trim()) return
    setSavingCat(true)
    const maxOrden = categorias.length > 0 ? Math.max(...categorias.map(c => c.orden)) + 1 : 1
    const { error } = await supabase.from("categorias").insert({
      nombre: nuevaCat.nombre.trim(),
      icono: nuevaCat.icono || "🍽️",
      orden: maxOrden,
      activo: true,
    })
    setSavingCat(false)
    if (error) { alert("Error: " + error.message); return }
    setNuevaCat({ nombre: "", icono: "🍽️" })
    loadCategorias()
  }

  async function loadCupones() {
    const { data } = await supabase.from("cupones").select("*").order("id", { ascending: false })
    setCupones(data || [])
  }

  async function uploadQR(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const { error } = await supabase.storage.from("config").upload(`qr-pago.${ext}`, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from("config").getPublicUrl(`qr-pago.${ext}`)
      setCfg((c) => ({ ...c, qr_pago_url: data.publicUrl + "?t=" + Date.now() }))
      setMsg("Imagen subida. Guarda los cambios.")
    } catch (e: unknown) {
      alert("Error: " + (e instanceof Error ? e.message : "Error al subir"))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true)
    setMsg("")
    const { error } = await supabase.from("configuracion").upsert({ id: 1, ...cfg })
    setSaving(false)
    setMsg(error ? "Error al guardar" : "✅ Guardado")
    setTimeout(() => setMsg(""), 3000)
  }

  async function guardarCupon() {
    if (!nuevoCupon.codigo.trim() || !nuevoCupon.valor) return
    setSavingCupon(true)
    const { error } = await supabase.from("cupones").insert({
      codigo: nuevoCupon.codigo.toUpperCase().trim(),
      tipo: nuevoCupon.tipo,
      valor: parseFloat(nuevoCupon.valor),
      usos_max: parseInt(nuevoCupon.usos_max) || 100,
      fecha_vencimiento: nuevoCupon.fecha_vencimiento || null,
      activo: true,
    })
    setSavingCupon(false)
    if (error) { alert("Error: " + error.message); return }
    setNuevoCupon({ codigo: "", tipo: "porcentaje", valor: "", usos_max: "100", fecha_vencimiento: "" })
    loadCupones()
  }

  async function toggleCupon(id: number, activo: boolean) {
    await supabase.from("cupones").update({ activo: !activo }).eq("id", id)
    loadCupones()
  }

  async function eliminarCupon(id: number) {
    if (!confirm("¿Eliminar cupón?")) return
    await supabase.from("cupones").delete().eq("id", id)
    loadCupones()
  }

  const TABS = [
    { key: "tienda", label: "Tienda & QR" },
    { key: "delivery", label: "Delivery" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "categorias", label: "📂 Categorías" },
    { key: "cupones", label: "Cupones" },
  ] as const

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Configuración</h2>
        <button
          onClick={save}
          disabled={saving || tab === "cupones"}
          className="bg-red-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 text-sm"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {msg && (
        <div className={`text-sm font-medium px-4 py-2 rounded-lg ${msg.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Tienda & QR */}
      {tab === "tienda" && (
        <div className="bg-white rounded-xl border shadow p-5 space-y-5">

          {/* Estado tienda */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Estado de la tienda</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCfg((c) => ({ ...c, abierto: true }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${cfg.abierto ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                ✅ Abierto
              </button>
              <button
                onClick={() => setCfg((c) => ({ ...c, abierto: false }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${!cfg.abierto ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                🔴 Cerrado
              </button>
            </div>
          </div>

          {/* Horario */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Horario de atención</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Apertura</label>
                <input type="time" value={cfg.hora_apertura} onChange={(e) => setCfg((c) => ({ ...c, hora_apertura: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cierre</label>
                <input type="time" value={cfg.hora_cierre} onChange={(e) => setCfg((c) => ({ ...c, hora_cierre: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Mensaje bienvenida */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mensaje de bienvenida</label>
            <input type="text" value={cfg.mensaje_bienvenida} onChange={(e) => setCfg((c) => ({ ...c, mensaje_bienvenida: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Tiempo estimado */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tiempo estimado de entrega</label>
            <input type="text" placeholder="ej: 30-45 min" value={cfg.tiempo_estimado} onChange={(e) => setCfg((c) => ({ ...c, tiempo_estimado: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* QR de pago */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-3">QR de Pago (Yape / BCP)</h3>
            {cfg.qr_pago_url && (
              <div className="flex items-center gap-3 mb-3">
                <img src={cfg.qr_pago_url} alt="QR" className="w-24 h-24 object-contain border rounded-lg" />
                <span className="text-sm text-green-600 font-medium">QR cargado</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQR(f) }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50">
              {uploading ? "Subiendo..." : "Subir imagen QR"}
            </button>
            <div className="mt-2">
              <label className="text-xs text-gray-500 block mb-1">o URL de imagen</label>
              <input type="url" value={cfg.qr_pago_url} onChange={(e) => setCfg((c) => ({ ...c, qr_pago_url: e.target.value }))} placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="mt-2">
              <label className="text-xs text-gray-500 block mb-1">Instrucciones para el cliente</label>
              <textarea value={cfg.instrucciones_pago} onChange={(e) => setCfg((c) => ({ ...c, instrucciones_pago: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Delivery */}
      {tab === "delivery" && (
        <div className="bg-white rounded-xl border shadow p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Configuración de Delivery</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Costo de envío ($)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={cfg.costo_envio}
                onChange={(e) => setCfg((c) => ({ ...c, costo_envio: parseFloat(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">0 = envío gratis</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Pedido mínimo ($)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={cfg.pedido_minimo}
                onChange={(e) => setCfg((c) => ({ ...c, pedido_minimo: parseFloat(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">0 = sin mínimo</p>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            El costo de envío se aplica cuando el cliente comparte su ubicación GPS. Sin GPS = recojo en tienda (sin costo extra).
          </div>
        </div>
      )}

      {/* TAB: WhatsApp */}
      {tab === "whatsapp" && (
        <div className="bg-white rounded-xl border shadow p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">Botón WhatsApp del negocio</h3>
            <p className="text-sm text-gray-500 mt-1">
              Este número aparece en el botón de WhatsApp del menú y en la pantalla de confirmación de pago QR,
              para que el cliente te envíe manualmente la confirmación de su pago.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
            <p className="font-semibold text-green-800 text-sm">¿Cómo funciona?</p>
            <p className="text-sm text-green-700">
              Cuando el cliente paga por QR, ve un botón <strong>&quot;Ya pagué · Confirmar por WhatsApp&quot;</strong> que abre
              WhatsApp con un mensaje pre-armado: pedido #, nombre, total y &quot;Ya realicé el pago por QR&quot;.
              Tú recibes el mensaje y verificas el pago en el sistema.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Número WhatsApp del negocio (con código de país, sin +)</label>
            <input
              type="text"
              placeholder="59177541305"
              value={cfg.whatsapp_phone}
              onChange={(e) => setCfg((c) => ({ ...c, whatsapp_phone: e.target.value.replace(/\D/g, '') }))}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Bolivia: 591 + tu número. Ej: <span className="font-mono">59177541305</span>
            </p>
          </div>

          {cfg.whatsapp_phone && (
            <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-600">
              Vista previa del link: <span className="font-mono text-green-700">wa.me/{cfg.whatsapp_phone}</span>
            </div>
          )}

          <button onClick={save} disabled={saving} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar número WhatsApp"}
          </button>
        </div>
      )}

      {/* TAB: Categorías */}
      {tab === "categorias" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800">Orden de categorías en el menú</h3>
              <p className="text-sm text-gray-500 mt-1">Usa las flechas ↑↓ para cambiar el orden. El cliente verá las categorías en este orden.</p>
            </div>

            {/* Lista ordenable */}
            <div className="divide-y border rounded-xl overflow-hidden">
              {categorias.map((cat, idx) => (
                <div key={cat.id} className={`flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors ${!cat.activo ? "opacity-50" : ""}`}>
                  {/* Número de orden */}
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Icono editable */}
                  <input
                    type="text"
                    value={cat.icono}
                    onChange={e => actualizarIcono(cat.id, e.target.value)}
                    className="w-10 text-center text-xl border rounded-lg py-1 focus:outline-none focus:border-red-400"
                    maxLength={4}
                  />

                  {/* Nombre */}
                  <span className="flex-1 font-semibold text-gray-800 text-sm">{cat.nombre}</span>

                  {/* Toggle visible */}
                  <button onClick={() => toggleCategoria(cat.id, cat.activo)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${cat.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {cat.activo ? "Visible" : "Oculta"}
                  </button>

                  {/* Flechas */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moverCategoria(cat.id, "arriba")}
                      disabled={idx === 0}
                      className="w-7 h-6 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-20 flex items-center justify-center text-xs font-bold transition-colors">
                      ↑
                    </button>
                    <button
                      onClick={() => moverCategoria(cat.id, "abajo")}
                      disabled={idx === categorias.length - 1}
                      className="w-7 h-6 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-20 flex items-center justify-center text-xs font-bold transition-colors">
                      ↓
                    </button>
                  </div>

                  {/* Eliminar */}
                  <button onClick={() => eliminarCategoria(cat.id, cat.nombre)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-sm shrink-0">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Agregar nueva categoría */}
            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 mb-2 font-semibold">Agregar nueva categoría</p>
              <div className="flex gap-2">
                <input type="text" placeholder="🍕" value={nuevaCat.icono}
                  onChange={e => setNuevaCat(c => ({ ...c, icono: e.target.value }))}
                  className="w-14 text-center text-xl border rounded-lg py-2 focus:outline-none focus:border-red-400" maxLength={4} />
                <input type="text" placeholder="Nombre de la categoría" value={nuevaCat.nombre}
                  onChange={e => setNuevaCat(c => ({ ...c, nombre: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") agregarCategoria() }}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                <button onClick={agregarCategoria} disabled={savingCat || !nuevaCat.nombre.trim()}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 shrink-0">
                  {savingCat ? "..." : "+ Agregar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Cupones */}
      {tab === "cupones" && (
        <div className="space-y-4">
          {/* Crear cupón */}
          <div className="bg-white rounded-xl border shadow p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Crear cupón</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Código (ej: PROMO10)"
                value={nuevoCupon.codigo}
                onChange={(e) => setNuevoCupon((c) => ({ ...c, codigo: e.target.value.toUpperCase() }))}
                className="border rounded-lg px-3 py-2 text-sm font-mono uppercase col-span-2"
              />
              <select
                value={nuevoCupon.tipo}
                onChange={(e) => setNuevoCupon((c) => ({ ...c, tipo: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="porcentaje">% Descuento</option>
                <option value="fijo">$ Monto fijo</option>
              </select>
              <input
                type="number"
                step="1"
                min="1"
                placeholder={nuevoCupon.tipo === "porcentaje" ? "% (ej: 10)" : "$ (ej: 5)"}
                value={nuevoCupon.valor}
                onChange={(e) => setNuevoCupon((c) => ({ ...c, valor: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <div>
                <label className="text-xs text-gray-400 block mb-1">Máx. usos</label>
                <input
                  type="number"
                  min="1"
                  value={nuevoCupon.usos_max}
                  onChange={(e) => setNuevoCupon((c) => ({ ...c, usos_max: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vence (opcional)</label>
                <input
                  type="date"
                  value={nuevoCupon.fecha_vencimiento}
                  onChange={(e) => setNuevoCupon((c) => ({ ...c, fecha_vencimiento: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={guardarCupon}
              disabled={savingCupon || !nuevoCupon.codigo || !nuevoCupon.valor}
              className="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {savingCupon ? "Guardando..." : "Crear Cupón"}
            </button>
          </div>

          {/* Lista cupones */}
          <div className="bg-white rounded-xl border shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-800">Cupones activos ({cupones.length})</h3>
            </div>
            {cupones.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Sin cupones creados</p>
            ) : (
              <div className="divide-y">
                {cupones.map((c) => (
                  <div key={c.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-sm">{c.codigo}</p>
                      <p className="text-xs text-gray-500">
                        {c.tipo === "porcentaje" ? `${c.valor}% off` : `$${c.valor} off`} · {c.usos_actuales}/{c.usos_max} usos
                        {c.fecha_vencimiento && ` · vence ${c.fecha_vencimiento}`}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCupon(c.id, c.activo)}
                      className={`px-2 py-1 rounded-full text-xs font-bold ${c.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </button>
                    <button onClick={() => eliminarCupon(c.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
