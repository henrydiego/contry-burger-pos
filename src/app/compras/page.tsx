"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"
import { Inventario } from "@/lib/types"

export default function ComprasPage() {
  const [compras, setCompras] = useState<Record<string, unknown>[]>([])
  const [ingredientes, setIngredientes] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    ingrediente_id: "",
    proveedor: "",
    cantidad: "",
    unidad: "kg",
    costo_unitario: "",
    notas: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [comprasRes, ingRes] = await Promise.all([
      supabase.from("compras").select("*").order("fecha", { ascending: false }),
      supabase.from("inventario").select("*"),
    ])
    setCompras(comprasRes.data || [])
    setIngredientes(ingRes.data || [])
    setLoading(false)
  }

  async function guardarCompra() {
    const cantidad = parseFloat(form.cantidad) || 0
    const costoUnitario = parseFloat(form.costo_unitario) || 0
    const costoTotal = cantidad * costoUnitario
    const ing = ingredientes.find((i) => i.ingrediente_id === form.ingrediente_id)

    const { error } = await supabase.from("compras").insert({
      ingrediente_id: form.ingrediente_id,
      ingrediente: ing?.nombre || "",
      proveedor: form.proveedor,
      cantidad,
      unidad: form.unidad,
      costo_unitario: costoUnitario,
      costo_total: costoTotal,
      notas: form.notas,
      fecha: form.fecha,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }

    // Update inventario: total_comprado and costo_promedio
    if (ing) {
      const nuevoTotalComprado = (Number(ing.total_comprado) || 0) + cantidad
      const costoActual = Number(ing.costo_promedio) || 0
      const totalAnterior = (Number(ing.total_comprado) || 0) * costoActual
      const nuevoCostoPromedio = nuevoTotalComprado > 0
        ? (totalAnterior + costoTotal) / nuevoTotalComprado
        : costoUnitario

      await supabase
        .from("inventario")
        .update({
          total_comprado: nuevoTotalComprado,
          costo_promedio: Number(nuevoCostoPromedio.toFixed(2)),
        })
        .eq("ingrediente_id", form.ingrediente_id)
    }

    setShowForm(false)
    setForm({
      ingrediente_id: "",
      proveedor: "",
      cantidad: "",
      unidad: "kg",
      costo_unitario: "",
      notas: "",
      fecha: new Date().toISOString().split("T")[0],
    })
    loadData()
  }

  async function editarCompra(rowIdx: number, key: string, value: string) {
    const compra = compras[rowIdx]
    const updateData: Record<string, unknown> = {}
    if (key === "cantidad") {
      const nueva = parseFloat(value) || 0
      updateData.cantidad = nueva
      updateData.costo_total = Number((nueva * (Number(compra.costo_unitario) || 0)).toFixed(2))
    } else if (key === "costo_unitario") {
      const nuevo = parseFloat(value) || 0
      updateData.costo_unitario = nuevo
      updateData.costo_total = Number(((Number(compra.cantidad) || 0) * nuevo).toFixed(2))
    } else {
      updateData[key] = value
    }
    await supabase.from("compras").update(updateData).eq("id", compra.id)
    loadData()
  }

  async function eliminarCompra(idx: number) {
    const compra = compras[idx]
    if (!confirm("Eliminar esta compra?")) return
    await supabase.from("compras").delete().eq("id", compra.id)
    loadData()
  }

  const totalCompras = compras.reduce((s, c) => s + (Number(c.costo_total) || 0), 0)

  // Monthly summary
  const mesActual = new Date().toISOString().slice(0, 7)
  const comprasMes = compras.filter((c) => String(c.fecha).startsWith(mesActual))
  const totalMes = comprasMes.reduce((s, c) => s + (Number(c.costo_total) || 0), 0)

  // Monthly summary by ingredient
  const resumenMes: Record<string, { ingrediente: string; cantidad: number; total: number }> = {}
  comprasMes.forEach((c) => {
    const key = String(c.ingrediente_id)
    if (!resumenMes[key]) {
      resumenMes[key] = { ingrediente: String(c.ingrediente), cantidad: 0, total: 0 }
    }
    resumenMes[key].cantidad += Number(c.cantidad) || 0
    resumenMes[key].total += Number(c.costo_total) || 0
  })
  const resumenRows = Object.values(resumenMes).map((r) => ({
    ...r,
    total: Number(r.total.toFixed(2)),
  }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Registro de Compras</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Nueva Compra
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Compras" value={`$${totalCompras.toFixed(2)}`} color="purple" icon="🛒" />
        <StatCard title="Compras Este Mes" value={`$${totalMes.toFixed(2)}`} color="blue" icon="📅" />
        <StatCard title="N Compras Mes" value={String(comprasMes.length)} color="green" icon="📦" />
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={form.ingrediente_id}
            onChange={(e) => {
              const ing = ingredientes.find((i) => i.ingrediente_id === e.target.value)
              setForm({ ...form, ingrediente_id: e.target.value, unidad: ing?.unidad || "kg" })
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Seleccionar ingrediente</option>
            {ingredientes.map((i) => (
              <option key={i.ingrediente_id} value={i.ingrediente_id}>
                {i.nombre} ({i.unidad})
              </option>
            ))}
          </select>
          <input
            placeholder="Proveedor"
            value={form.proveedor}
            onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
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
          <input
            placeholder="Costo Unitario"
            type="number"
            step="0.01"
            value={form.costo_unitario}
            onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Notas"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex items-center text-sm text-gray-600">
            Total: <span className="font-bold ml-1">
              ${((parseFloat(form.cantidad) || 0) * (parseFloat(form.costo_unitario) || 0)).toFixed(2)}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExcelTable
            title="Historial de Compras"
            columns={[
              { key: "id", label: "# Compra", width: "90px" },
              { key: "fecha", label: "Fecha", type: "date", editable: true },
              { key: "ingrediente", label: "Ingrediente" },
              { key: "proveedor", label: "Proveedor", editable: true },
              { key: "cantidad", label: "Cant.", type: "number", editable: true },
              { key: "unidad", label: "Unidad" },
              { key: "costo_unitario", label: "C. Unit.", type: "currency", editable: true },
              { key: "costo_total", label: "Total", type: "currency" },
            ]}
            data={compras}
            onEdit={editarCompra}
            onDelete={eliminarCompra}
          />
        </div>
        <div>
          <ExcelTable
            title="Resumen Mensual"
            columns={[
              { key: "ingrediente", label: "Ingrediente" },
              { key: "cantidad", label: "Cant.", type: "number" },
              { key: "total", label: "Total", type: "currency" },
            ]}
            data={resumenRows as Record<string, unknown>[]}
            showRowNumbers={false}
          />
        </div>
      </div>
    </div>
  )
}
