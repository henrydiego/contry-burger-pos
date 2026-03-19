"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

interface Producto {
  id: string
  nombre: string
  categoria: string
  descripcion: string | null
  costo_manual: number
  costo: number            // auto-calculado desde recetas (solo lectura)
  precio_venta: number
  activo: boolean
  agotado: boolean
  imagen_url: string | null
}

const CATEGORIAS = ["Hamburguesas", "Hot Dogs", "Bebidas", "Combos", "Acompanantes"]

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [vistaFotos, setVistaFotos] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const formVacio = {
    id: "", nombre: "", descripcion: "", categoria: "", costo_manual: "", precio_venta: "", activo: true,
  }
  const [form, setForm] = useState(formVacio)

  useEffect(() => { loadProductos() }, [])

  async function loadProductos() {
    const { data } = await supabase.from("productos").select("*").order("categoria")
    setProductos((data || []) as Producto[])
    setLoading(false)
  }

  async function guardarProducto() {
    if (!form.id.trim() || !form.nombre.trim() || !form.categoria.trim()) {
      alert("ID, Nombre y Categoría son obligatorios"); return
    }
    setGuardando(true)
    const payload = {
      id: form.id.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria.trim(),
      costo_manual: parseFloat(form.costo_manual) || 0,
      precio_venta: parseFloat(form.precio_venta) || 0,
      activo: form.activo,
      agotado: false,
    }
    const { error } = await supabase.from("productos").insert(payload)
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setShowForm(false)
    setForm(formVacio)
    loadProductos()
  }

  async function eliminarProducto(prod: Producto) {
    if (!confirm(`¿Eliminar "${prod.nombre}"?`)) return
    await supabase.from("productos").delete().eq("id", prod.id)
    loadProductos()
  }

  async function toggleActivo(prod: Producto) {
    await supabase.from("productos").update({ activo: !prod.activo }).eq("id", prod.id)
    loadProductos()
  }

  async function toggleAgotado(prod: Producto) {
    await supabase.from("productos").update({ agotado: !prod.agotado }).eq("id", prod.id)
    loadProductos()
  }

  async function editarCampo(prod: Producto, campo: string, valor: string) {
    const updateData: Record<string, unknown> = {}
    if (campo === "precio_venta" || campo === "costo_manual") updateData[campo] = parseFloat(valor) || 0
    else updateData[campo] = valor
    await supabase.from("productos").update(updateData).eq("id", prod.id)
    loadProductos()
  }

  async function uploadFoto(prod: Producto, file: File) {
    setUploadingId(prod.id)
    try {
      const ext = file.name.split(".").pop()
      const path = `${prod.id}.${ext}`
      const { error } = await supabase.storage.from("productos").upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from("productos").getPublicUrl(path)
      await supabase.from("productos").update({ imagen_url: data.publicUrl + "?t=" + Date.now() }).eq("id", prod.id)
      loadProductos()
    } catch (e: unknown) {
      alert("Error al subir: " + (e instanceof Error ? e.message : "desconocido"))
    } finally {
      setUploadingId(null)
    }
  }

  async function quitarFoto(prod: Producto) {
    await supabase.from("productos").update({ imagen_url: null }).eq("id", prod.id)
    loadProductos()
  }

  const productosConMargen = productos.map(p => {
    const costoBase = p.costo_manual > 0 ? p.costo_manual : p.costo
    const margen = p.precio_venta > 0 ? ((p.precio_venta - costoBase) / p.precio_venta) * 100 : 0
    return { ...p, costoBase, margen }
  })

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Productos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setVistaFotos(!vistaFotos)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${vistaFotos ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
          >
            {vistaFotos ? "📋 Vista tabla" : "📸 Fotos & Estado"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            + Nuevo producto
          </button>
        </div>
      </div>

      {/* Formulario nuevo producto */}
      {showForm && (
        <div className="bg-white rounded-xl border shadow p-5 space-y-4">
          <h3 className="font-bold text-gray-800">Agregar nuevo producto</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">ID del producto *</label>
              <input placeholder="ej: HAMB001" value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
              <input placeholder="ej: Hamburguesa de Champiñones" value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Categoría *</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">— Seleccionar —</option>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción (opcional)</label>
              <input placeholder="ej: Con champiñones salteados y queso suizo" value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">💰 Costo ($) — lo que te cuesta hacer</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.costo_manual}
                onChange={e => setForm({ ...form, costo_manual: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">🏷️ Precio de Venta ($)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.precio_venta}
                onChange={e => setForm({ ...form, precio_venta: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Preview margen */}
          {form.costo_manual && form.precio_venta && (() => {
            const c = parseFloat(form.costo_manual) || 0
            const p = parseFloat(form.precio_venta) || 0
            const m = p > 0 ? ((p - c) / p * 100) : 0
            return (
              <div className={`rounded-lg px-4 py-2 text-sm font-semibold text-center ${m >= 30 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                Margen: {m.toFixed(1)}% — Ganancia por unidad: ${(p - c).toFixed(2)}
              </div>
            )
          })()}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="w-4 h-4 accent-red-600" />
              Visible en el menú del cliente
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={guardarProducto} disabled={guardando}
              className="flex-1 bg-green-600 text-white rounded-xl py-2.5 font-bold text-sm hover:bg-green-700 disabled:opacity-50">
              {guardando ? "Guardando..." : "💾 Guardar producto"}
            </button>
            <button onClick={() => { setShowForm(false); setForm(formVacio) }}
              className="px-5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Vista Fotos & Estado ── */}
      {vistaFotos ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {productosConMargen.map(prod => (
            <div key={prod.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${!prod.activo ? "opacity-60" : ""}`}>
              {/* Foto */}
              <div className="relative h-32 bg-gray-100">
                {prod.imagen_url ? (
                  <>
                    <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-cover" />
                    <button onClick={() => quitarFoto(prod)}
                      className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-700">
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                    <span className="text-3xl">📷</span>
                    <span>Sin foto</span>
                  </div>
                )}
                {uploadingId === prod.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <svg className="w-6 h-6 animate-spin text-red-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </div>
                )}
                {/* Badge categoría */}
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {prod.categoria}
                </span>
              </div>

              <div className="p-2.5 space-y-1.5">
                <p className="text-xs font-bold leading-tight line-clamp-2">{prod.nombre}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-red-600">${prod.precio_venta.toFixed(2)}</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${prod.margen >= 30 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {prod.margen.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400">Costo: ${prod.costoBase.toFixed(2)}</p>

                <div className="flex flex-col gap-1 pt-0.5">
                  {/* Input foto oculto */}
                  <input ref={el => { fileRefs.current[prod.id] = el }} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(prod, f) }} />
                  <button onClick={() => fileRefs.current[prod.id]?.click()} disabled={uploadingId === prod.id}
                    className="w-full bg-gray-800 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50">
                    📸 {prod.imagen_url ? "Cambiar foto" : "Subir foto"}
                  </button>
                  <button onClick={() => toggleAgotado(prod)}
                    className={`w-full py-1.5 rounded-lg text-xs font-semibold ${prod.agotado ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                    {prod.agotado ? "⛔ Agotado" : "✅ Disponible"}
                  </button>
                  <button onClick={() => toggleActivo(prod)}
                    className={`w-full py-1.5 rounded-lg text-xs font-semibold ${prod.activo ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    {prod.activo ? "👁 Visible en menú" : "🚫 Oculto en menú"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Vista Tabla ── */
        <div className="bg-white rounded-xl border shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-right">Costo ($)</th>
                  <th className="px-4 py-3 text-right">Precio Venta ($)</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                  <th className="px-4 py-3 text-center">Estado menú</th>
                  <th className="px-4 py-3 text-center">Stock</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productosConMargen.map(prod => (
                  <tr key={prod.id} className={`hover:bg-gray-50 transition-colors ${!prod.activo ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{prod.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{prod.nombre}</p>
                        {prod.descripcion && <p className="text-xs text-gray-400 mt-0.5">{prod.descripcion}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{prod.categoria}</td>
                    <td className="px-4 py-3 text-right">
                      <EditableCell
                        value={prod.costoBase.toFixed(2)}
                        onSave={val => editarCampo(prod, "costo_manual", val)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <EditableCell
                        value={prod.precio_venta.toFixed(2)}
                        onSave={val => editarCampo(prod, "precio_venta", val)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${prod.margen >= 30 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {prod.margen.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActivo(prod)}
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${prod.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {prod.activo ? "✅ Visible" : "🚫 Oculto"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleAgotado(prod)}
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${prod.agotado ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-600"}`}>
                        {prod.agotado ? "⛔ Agotado" : "🟢 Hay stock"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => eliminarProducto(prod)}
                        className="text-red-400 hover:text-red-600 text-xs underline">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-400">
            💡 Haz clic en Costo o Precio para editar directo en la tabla
          </div>
        </div>
      )}
    </div>
  )
}

/* Celda editable con click */
function EditableCell({ value, onSave }: { value: string; onSave: (val: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  if (editing) {
    return (
      <input
        type="number" step="0.01" value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(val) }}
        onKeyDown={e => { if (e.key === "Enter") { setEditing(false); onSave(val) } if (e.key === "Escape") setEditing(false) }}
        className="w-24 border border-blue-400 rounded px-2 py-1 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    )
  }
  return (
    <button onClick={() => { setVal(value); setEditing(true) }}
      className="text-sm font-semibold text-gray-700 hover:text-blue-600 hover:underline cursor-pointer">
      ${value}
    </button>
  )
}
