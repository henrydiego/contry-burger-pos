"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"

interface RecetaRow {
  id: number
  producto_id: number
  ingrediente: string
  cantidad: number
  unidad: string
  costo: number
  producto_nombre: string
}

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [productos, setProductos] = useState<{ id: number; nombre: string; precio_venta: number }[]>([])
  const [form, setForm] = useState({
    producto_id: "",
    ingrediente: "",
    cantidad: "",
    unidad: "kg",
    costo: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [recRes, prodRes] = await Promise.all([
      supabase.from("recetas").select("*, producto:productos(nombre, precio_venta)"),
      supabase.from("productos").select("id, nombre, precio_venta").eq("activo", true),
    ])

    const rows = (recRes.data || []).map((r) => ({
      ...r,
      producto_nombre: (r.producto as { nombre?: string })?.nombre || "—",
    }))

    setRecetas(rows)
    setProductos(prodRes.data || [])
    setLoading(false)
  }

  async function guardarReceta() {
    const { error } = await supabase.from("recetas").insert({
      producto_id: parseInt(form.producto_id),
      ingrediente: form.ingrediente,
      cantidad: parseFloat(form.cantidad),
      unidad: form.unidad,
      costo: parseFloat(form.costo),
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({ producto_id: "", ingrediente: "", cantidad: "", unidad: "kg", costo: "" })
    loadData()
  }

  async function eliminarReceta(idx: number) {
    const receta = recetas[idx]
    if (!confirm("Eliminar ingrediente de receta?")) return
    await supabase.from("recetas").delete().eq("id", receta.id)
    loadData()
  }

  async function editarCelda(rowIdx: number, key: string, value: string) {
    const receta = recetas[rowIdx]
    const updateData: Record<string, unknown> = {}
    if (key === "cantidad" || key === "costo") {
      updateData[key] = parseFloat(value) || 0
    } else {
      updateData[key] = value
    }
    await supabase.from("recetas").update(updateData).eq("id", receta.id)
    loadData()
  }

  // Costeo por producto
  const costeoMap: Record<number, { nombre: string; costoTotal: number; precioVenta: number }> = {}
  recetas.forEach((r) => {
    if (!costeoMap[r.producto_id]) {
      const prod = productos.find((p) => p.id === r.producto_id)
      costeoMap[r.producto_id] = {
        nombre: r.producto_nombre,
        costoTotal: 0,
        precioVenta: prod?.precio_venta || 0,
      }
    }
    costeoMap[r.producto_id].costoTotal += r.costo
  })

  const costeoRows = Object.entries(costeoMap).map(([id, data]) => ({
    producto_id: id,
    producto: data.nombre,
    costo_receta: data.costoTotal.toFixed(2),
    precio_venta: data.precioVenta.toFixed(2),
    ganancia: (data.precioVenta - data.costoTotal).toFixed(2),
    margen: data.precioVenta > 0
      ? (((data.precioVenta - data.costoTotal) / data.precioVenta) * 100).toFixed(1) + "%"
      : "N/A",
  }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recetas y Costeo</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Agregar Ingrediente
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-6 gap-3">
          <select
            value={form.producto_id}
            onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <input
            placeholder="Ingrediente"
            value={form.ingrediente}
            onChange={(e) => setForm({ ...form, ingrediente: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Cantidad"
            type="number"
            step="0.01"
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <select
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="kg">kg</option>
            <option value="gr">gr</option>
            <option value="lt">lt</option>
            <option value="ml">ml</option>
            <option value="pz">pz</option>
          </select>
          <input
            placeholder="Costo $"
            type="number"
            step="0.01"
            value={form.costo}
            onChange={(e) => setForm({ ...form, costo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={guardarReceta}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

      {/* Costeo Summary */}
      {costeoRows.length > 0 && (
        <ExcelTable
          title="Resumen de Costeo por Producto"
          columns={[
            { key: "producto", label: "Producto" },
            { key: "costo_receta", label: "Costo Receta", type: "currency" },
            { key: "precio_venta", label: "Precio Venta", type: "currency" },
            { key: "ganancia", label: "Ganancia", type: "currency" },
            { key: "margen", label: "Margen %" },
          ]}
          data={costeoRows}
          showRowNumbers={false}
        />
      )}

      {/* Detail */}
      <ExcelTable
        title="Detalle de Recetas (doble clic para editar)"
        columns={[
          { key: "id", label: "ID", width: "60px" },
          { key: "producto_nombre", label: "Producto" },
          { key: "ingrediente", label: "Ingrediente", editable: true },
          { key: "cantidad", label: "Cantidad", type: "number", editable: true },
          { key: "unidad", label: "Unidad", editable: true },
          { key: "costo", label: "Costo $", type: "currency", editable: true },
        ]}
        data={recetas as unknown as Record<string, unknown>[]}
        onEdit={editarCelda}
        onDelete={eliminarReceta}
      />
    </div>
  )
}
