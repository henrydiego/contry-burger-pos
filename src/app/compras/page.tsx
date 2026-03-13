"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"

interface CompraRow {
  id: number
  proveedor: string
  producto: string
  cantidad: number
  unidad: string
  precio_unitario: number
  total: number
  fecha: string
}

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    proveedor: "",
    producto: "",
    cantidad: "",
    unidad: "kg",
    precio_unitario: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    loadCompras()
  }, [])

  async function loadCompras() {
    const { data } = await supabase
      .from("compras")
      .select("*")
      .order("fecha", { ascending: false })
    setCompras(data || [])
    setLoading(false)
  }

  async function guardarCompra() {
    const cantidad = parseFloat(form.cantidad)
    const precioUnitario = parseFloat(form.precio_unitario)
    const { error } = await supabase.from("compras").insert({
      proveedor: form.proveedor,
      producto: form.producto,
      cantidad,
      unidad: form.unidad,
      precio_unitario: precioUnitario,
      total: cantidad * precioUnitario,
      fecha: form.fecha,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({
      proveedor: "",
      producto: "",
      cantidad: "",
      unidad: "kg",
      precio_unitario: "",
      fecha: new Date().toISOString().split("T")[0],
    })
    loadCompras()
  }

  async function eliminarCompra(idx: number) {
    const compra = compras[idx]
    if (!confirm("Eliminar esta compra?")) return
    await supabase.from("compras").delete().eq("id", compra.id)
    loadCompras()
  }

  const totalCompras = compras.reduce((s, c) => s + (c.total || 0), 0)

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Registro de Compras</h2>
          <p className="text-sm text-gray-500">
            Total acumulado: <span className="font-bold text-[var(--primary)]">${totalCompras.toFixed(2)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Nueva Compra
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            placeholder="Proveedor"
            value={form.proveedor}
            onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Producto / Insumo"
            value={form.producto}
            onChange={(e) => setForm({ ...form, producto: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
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
            <option value="kg">Kilogramos</option>
            <option value="lt">Litros</option>
            <option value="pz">Piezas</option>
            <option value="paq">Paquetes</option>
            <option value="caja">Cajas</option>
          </select>
          <input
            placeholder="Precio Unitario"
            type="number"
            step="0.01"
            value={form.precio_unitario}
            onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex items-center text-sm text-gray-600">
            Total: <span className="font-bold ml-1">
              ${((parseFloat(form.cantidad) || 0) * (parseFloat(form.precio_unitario) || 0)).toFixed(2)}
            </span>
          </div>
          <button
            onClick={guardarCompra}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

      <ExcelTable
        title="Historial de Compras"
        columns={[
          { key: "id", label: "ID", width: "60px" },
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "proveedor", label: "Proveedor" },
          { key: "producto", label: "Producto" },
          { key: "cantidad", label: "Cant.", type: "number" },
          { key: "unidad", label: "Unidad" },
          { key: "precio_unitario", label: "P. Unit.", type: "currency" },
          { key: "total", label: "Total", type: "currency" },
        ]}
        data={compras as unknown as Record<string, unknown>[]}
        onDelete={eliminarCompra}
      />
    </div>
  )
}
