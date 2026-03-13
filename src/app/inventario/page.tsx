"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"

interface InventarioRow {
  id: number
  producto_id: number
  cantidad: number
  unidad: string
  stock_minimo: number
  ultima_actualizacion: string
  producto_nombre: string
  estado: string
}

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    unidad: "pz",
    stock_minimo: "",
  })
  const [productos, setProductos] = useState<{ id: number; nombre: string }[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [invRes, prodRes] = await Promise.all([
      supabase.from("inventario").select("*, producto:productos(nombre)"),
      supabase.from("productos").select("id, nombre").eq("activo", true),
    ])

    const rows = (invRes.data || []).map((item) => ({
      ...item,
      producto_nombre: (item.producto as { nombre?: string })?.nombre || "—",
      estado:
        item.cantidad <= 0
          ? "SIN STOCK"
          : item.cantidad <= item.stock_minimo
          ? "BAJO"
          : "OK",
    }))

    setInventario(rows)
    setProductos(prodRes.data || [])
    setLoading(false)
  }

  async function guardarInventario() {
    const { error } = await supabase.from("inventario").insert({
      producto_id: parseInt(form.producto_id),
      cantidad: parseFloat(form.cantidad),
      unidad: form.unidad,
      stock_minimo: parseFloat(form.stock_minimo),
      ultima_actualizacion: new Date().toISOString(),
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({ producto_id: "", cantidad: "", unidad: "pz", stock_minimo: "" })
    loadData()
  }

  async function editarCelda(rowIdx: number, key: string, value: string) {
    const item = inventario[rowIdx]
    const updateData: Record<string, unknown> = {}
    if (key === "cantidad" || key === "stock_minimo") {
      updateData[key] = parseFloat(value) || 0
    } else {
      updateData[key] = value
    }
    updateData.ultima_actualizacion = new Date().toISOString()
    await supabase.from("inventario").update(updateData).eq("id", item.id)
    loadData()
  }

  async function eliminarInventario(idx: number) {
    const item = inventario[idx]
    if (!confirm("Eliminar registro de inventario?")) return
    await supabase.from("inventario").delete().eq("id", item.id)
    loadData()
  }

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  const alertas = inventario.filter((i) => i.estado !== "OK")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inventario</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Agregar Item
        </button>
      </div>

      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 font-semibold text-sm">
            Alertas de Stock Bajo ({alertas.length}):
          </p>
          <ul className="text-red-600 text-xs mt-1 space-y-0.5">
            {alertas.map((a) => (
              <li key={a.id}>
                {a.producto_nombre}: {a.cantidad} {a.unidad} (min: {a.stock_minimo})
                — {a.estado}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            value={form.producto_id}
            onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Seleccionar producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <input
            placeholder="Cantidad"
            type="number"
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <select
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="pz">Piezas</option>
            <option value="kg">Kilogramos</option>
            <option value="lt">Litros</option>
            <option value="paq">Paquetes</option>
          </select>
          <input
            placeholder="Stock Minimo"
            type="number"
            value={form.stock_minimo}
            onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={guardarInventario}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

      <ExcelTable
        title="Control de Inventario (doble clic para editar)"
        columns={[
          { key: "id", label: "ID", width: "60px" },
          { key: "producto_nombre", label: "Producto" },
          { key: "cantidad", label: "Cantidad", type: "number", editable: true },
          { key: "unidad", label: "Unidad", editable: true },
          { key: "stock_minimo", label: "Stock Min.", type: "number", editable: true },
          { key: "estado", label: "Estado" },
          { key: "ultima_actualizacion", label: "Ult. Actualiz.", type: "date" },
        ]}
        data={inventario as unknown as Record<string, unknown>[]}
        onEdit={editarCelda}
        onDelete={eliminarInventario}
      />
    </div>
  )
}
