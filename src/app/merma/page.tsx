"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

interface MermaRow {
  id: number
  producto_id: number
  cantidad: number
  unidad: string
  motivo: string
  fecha: string
  costo_perdida: number
  producto_nombre: string
}

export default function MermaPage() {
  const [merma, setMerma] = useState<MermaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [productos, setProductos] = useState<{ id: number; nombre: string; costo_unitario: number }[]>([])
  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    unidad: "pz",
    motivo: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [mermaRes, prodRes] = await Promise.all([
      supabase.from("merma").select("*, producto:productos(nombre)").order("fecha", { ascending: false }),
      supabase.from("productos").select("id, nombre, costo_unitario").eq("activo", true),
    ])

    const rows = (mermaRes.data || []).map((m) => ({
      ...m,
      producto_nombre: (m.producto as { nombre?: string })?.nombre || "—",
    }))

    setMerma(rows)
    setProductos(prodRes.data || [])
    setLoading(false)
  }

  async function guardarMerma() {
    const prod = productos.find((p) => p.id === parseInt(form.producto_id))
    const cantidad = parseFloat(form.cantidad)
    const costoPerdida = (prod?.costo_unitario || 0) * cantidad

    const { error } = await supabase.from("merma").insert({
      producto_id: parseInt(form.producto_id),
      cantidad,
      unidad: form.unidad,
      motivo: form.motivo,
      fecha: form.fecha,
      costo_perdida: costoPerdida,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({ producto_id: "", cantidad: "", unidad: "pz", motivo: "", fecha: new Date().toISOString().split("T")[0] })
    loadData()
  }

  async function eliminarMerma(idx: number) {
    const item = merma[idx]
    if (!confirm("Eliminar registro de merma?")) return
    await supabase.from("merma").delete().eq("id", item.id)
    loadData()
  }

  const totalMerma = merma.reduce((s, m) => s + (m.costo_perdida || 0), 0)
  const mermaMes = merma
    .filter((m) => m.fecha >= new Date().toISOString().slice(0, 7))
    .reduce((s, m) => s + (m.costo_perdida || 0), 0)

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Control de Merma</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Registrar Merma
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Merma Total" value={`$${totalMerma.toFixed(2)}`} color="red" icon="📉" />
        <StatCard title="Merma Este Mes" value={`$${mermaMes.toFixed(2)}`} color="yellow" icon="⚠️" />
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
          </select>
          <input
            placeholder="Motivo"
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={guardarMerma}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

      <ExcelTable
        title="Registro de Merma"
        columns={[
          { key: "id", label: "ID", width: "60px" },
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "producto_nombre", label: "Producto" },
          { key: "cantidad", label: "Cantidad", type: "number" },
          { key: "unidad", label: "Unidad" },
          { key: "motivo", label: "Motivo" },
          { key: "costo_perdida", label: "Costo Perdida", type: "currency" },
        ]}
        data={merma as unknown as Record<string, unknown>[]}
        onDelete={eliminarMerma}
      />
    </div>
  )
}
