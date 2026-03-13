"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Producto } from "@/lib/types"
import ExcelTable from "@/components/ExcelTable"

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    id: "",
    nombre: "",
    categoria: "",
    costo: "",
    precio_venta: "",
    activo: true,
  })

  useEffect(() => {
    loadProductos()
  }, [])

  async function loadProductos() {
    const { data } = await supabase
      .from("productos")
      .select("*")
      .order("categoria")
    setProductos(data || [])
    setLoading(false)
  }

  async function guardarProducto() {
    const payload = {
      id: form.id,
      nombre: form.nombre,
      categoria: form.categoria,
      costo: parseFloat(form.costo) || 0,
      precio_venta: parseFloat(form.precio_venta) || 0,
      activo: form.activo,
    }
    const { error } = await supabase.from("productos").insert(payload)
    if (error) {
      alert("Error: " + error.message)
      return
    }
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
    if (key === "precio_venta" || key === "costo") {
      updateData[key] = parseFloat(value) || 0
    } else if (key === "activo") {
      updateData[key] = value === "true" || value === "1"
    } else {
      updateData[key] = value
    }
    await supabase.from("productos").update(updateData).eq("id", prod.id)
    loadProductos()
  }

  const productosConMargen = productos.map((p) => {
    const margenPeso = p.precio_venta - p.costo
    const margenPct = p.precio_venta > 0
      ? ((margenPeso / p.precio_venta) * 100)
      : 0
    return {
      ...p,
      margen_peso: margenPeso.toFixed(2),
      margen_pct: margenPct.toFixed(1) + "%",
      estado_margen: margenPct > 30 ? "Bueno" : "Revisar",
    }
  })

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Productos</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Nuevo Producto
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-6 gap-3">
          <input
            placeholder="ID (ej: PROD001)"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Categoria"
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Costo"
            type="number"
            step="0.01"
            value={form.costo}
            onChange={(e) => setForm({ ...form, costo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Precio Venta"
            type="number"
            step="0.01"
            value={form.precio_venta}
            onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={guardarProducto}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

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
    </div>
  )
}
