"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Producto } from "@/lib/types"
import ExcelTable from "@/components/ExcelTable"

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [vistaFotos, setVistaFotos] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [form, setForm] = useState({
    id: "", nombre: "", categoria: "", costo: "", precio_venta: "", activo: true,
  })

  useEffect(() => { loadProductos() }, [])

  async function loadProductos() {
    const { data } = await supabase.from("productos").select("*").order("categoria")
    setProductos(data || [])
    setLoading(false)
  }

  async function guardarProducto() {
    const payload = {
      id: form.id, nombre: form.nombre, categoria: form.categoria,
      costo: parseFloat(form.costo) || 0, precio_venta: parseFloat(form.precio_venta) || 0, activo: form.activo,
    }
    const { error } = await supabase.from("productos").insert(payload)
    if (error) { alert("Error: " + error.message); return }
    setShowForm(false)
    setForm({ id: "", nombre: "", categoria: "", costo: "", precio_venta: "", activo: true })
    loadProductos()
  }

  async function eliminarProducto(idx: number) {
    const prod = productos[idx]
    if (!confirm(`Eliminar "${prod.nombre}"?`)) return
    await supabase.from("productos").delete().eq("id", prod.id)
    loadProductos()
  }

  async function editarCelda(rowIdx: number, key: string, value: string) {
    const prod = productos[rowIdx]
    const updateData: Record<string, unknown> = {}
    if (key === "precio_venta" || key === "costo") updateData[key] = parseFloat(value) || 0
    else if (key === "activo") updateData[key] = value === "true" || value === "1"
    else updateData[key] = value
    await supabase.from("productos").update(updateData).eq("id", prod.id)
    loadProductos()
  }

  async function toggleAgotado(prod: Producto) {
    await supabase.from("productos").update({ agotado: !prod.agotado }).eq("id", prod.id)
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
      alert("Error: " + (e instanceof Error ? e.message : "Error al subir"))
    } finally {
      setUploadingId(null)
    }
  }

  async function quitarFoto(prod: Producto) {
    await supabase.from("productos").update({ imagen_url: null }).eq("id", prod.id)
    loadProductos()
  }

  const productosConMargen = productos.map((p) => {
    const margenPeso = p.precio_venta - p.costo
    const margenPct = p.precio_venta > 0 ? ((margenPeso / p.precio_venta) * 100) : 0
    return { ...p, margen_peso: margenPeso.toFixed(2), margen_pct: margenPct.toFixed(1) + "%", estado_margen: margenPct > 30 ? "Bueno" : "Revisar" }
  })

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Productos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setVistaFotos(!vistaFotos)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${vistaFotos ? "bg-gray-800 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            {vistaFotos ? "Vista tabla" : "📸 Fotos & Estado"}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700">
            + Nuevo
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-6 gap-3">
          <input placeholder="ID (ej: PROD001)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Costo" type="number" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Precio Venta" type="number" step="0.01" value={form.precio_venta} onChange={(e) => setForm({ ...form, precio_venta: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <button onClick={guardarProducto} className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700">Guardar</button>
        </div>
      )}

      {/* Vista fotos & estado */}
      {vistaFotos ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {productos.map((prod) => (
            <div key={prod.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${!prod.activo ? "opacity-50" : ""}`}>
              {/* Foto */}
              <div className="relative h-28 bg-gray-100">
                {(prod as Produto & { imagen_url?: string }).imagen_url ? (
                  <>
                    <img src={(prod as Produto & { imagen_url?: string }).imagen_url} alt={prod.nombre} className="w-full h-full object-cover" />
                    <button onClick={() => quitarFoto(prod)} className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-700">✕</button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                    <span className="text-2xl">📷</span>
                    <span>Sin foto</span>
                  </div>
                )}
                {uploadingId === prod.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <svg className="w-6 h-6 animate-spin text-red-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  </div>
                )}
              </div>

              <div className="p-2.5 space-y-2">
                <p className="text-xs font-semibold leading-tight line-clamp-2">{prod.nombre}</p>
                <p className="text-xs text-gray-400">{prod.categoria}</p>
                <p className="text-sm font-bold text-red-600">${prod.precio_venta.toFixed(2)}</p>

                {/* Botones */}
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={(el) => { fileRefs.current[prod.id] = el }}
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(prod, f) }}
                  />
                  <button
                    onClick={() => fileRefs.current[prod.id]?.click()}
                    disabled={uploadingId === prod.id}
                    className="w-full bg-gray-800 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50"
                  >
                    📸 {(prod as Produto & { imagen_url?: string }).imagen_url ? "Cambiar foto" : "Subir foto"}
                  </button>
                  <button
                    onClick={() => toggleAgotado(prod)}
                    className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${(prod as Produto & { agotado?: boolean }).agotado ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                  >
                    {(prod as Produto & { agotado?: boolean }).agotado ? "⛔ Agotado" : "✅ Disponible"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ExcelTable
          title="Catalogo de Productos (doble clic para editar)"
          columns={[
            { key: "id", label: "ID", width: "80px" },
            { key: "nombre", label: "Nombre", editable: true },
            { key: "categoria", label: "Categoria", editable: true },
            { key: "costo", label: "Costo", type: "currency", editable: true },
            { key: "precio_venta", label: "Precio Venta", type: "currency", editable: true },
            { key: "margen_peso", label: "Margen $", type: "currency" },
            { key: "margen_pct", label: "Margen %" },
            { key: "estado_margen", label: "Estado" },
          ]}
          data={productosConMargen as unknown as Record<string, unknown>[]}
          onEdit={editarCelda}
          onDelete={eliminarProducto}
        />
      )}
    </div>
  )
}

// Workaround for extended type
type Produto = Producto & { imagen_url?: string; agotado?: boolean }
