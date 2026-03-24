"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

const TIPOS_GASTO = [
  "Alquiler",
  "Ingredientes",
  "Servicios",
  "Personal",
  "Mantenimiento",
  "Marketing",
  "Impuestos",
  "Otros",
]

export default function GastosPage() {
  const [gastos, setGastos] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    tipo: "Ingredientes",
    descripcion: "",
    monto: "",
  })

  useEffect(() => {
    loadGastos()
  }, [])

  async function loadGastos() {
    const { data } = await supabase
      .from("gastos")
      .select("*")
      .order("fecha", { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }

  async function guardarGasto() {
    const fecha = form.fecha
    const mes = parseInt(fecha.split("-")[1])
    const anio = parseInt(fecha.split("-")[0])

    const { error } = await supabase.from("gastos").insert({
      fecha,
      tipo: form.tipo,
      descripcion: form.descripcion,
      monto: parseFloat(form.monto) || 0,
      mes,
      anio,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      tipo: "Ingredientes",
      descripcion: "",
      monto: "",
    })
    loadGastos()
  }

  async function eliminarGasto(idx: number) {
    const gasto = gastosFiltrados[idx]
    if (!confirm("Eliminar este gasto?")) return
    await supabase.from("gastos").delete().eq("id", gasto.id)
    loadGastos()
  }

  async function editarCelda(rowIdx: number, key: string, value: string) {
    const gasto = gastosFiltrados[rowIdx]
    const updateData: Record<string, unknown> = {}
    if (key === "monto") {
      updateData[key] = parseFloat(value) || 0
    } else if (key === "fecha") {
      updateData.fecha = value
      updateData.mes = parseInt(value.split("-")[1])
      updateData.anio = parseInt(value.split("-")[0])
    } else {
      updateData[key] = value
    }
    await supabase.from("gastos").update(updateData).eq("id", gasto.id)
    loadGastos()
  }

  const gastosFiltrados = filtroMes
    ? gastos.filter((g) => String(g.fecha).startsWith(filtroMes))
    : gastos

  const totalGastos = gastosFiltrados.reduce((s, g) => s + (Number(g.monto) || 0), 0)

  // By tipo
  const porTipo: Record<string, number> = {}
  gastosFiltrados.forEach((g) => {
    const tipo = String(g.tipo)
    porTipo[tipo] = (porTipo[tipo] || 0) + (Number(g.monto) || 0)
  })
  const resumenTipo = Object.entries(porTipo).map(([tipo, monto]) => ({
    tipo,
    monto: Number(monto.toFixed(2)),
    porcentaje: totalGastos > 0 ? ((monto / totalGastos) * 100).toFixed(1) + "%" : "0%",
  }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gastos</h2>
        <div className="flex gap-2 items-center">
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
          >
            + Nuevo Gasto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Total Gastos" value={`$${totalGastos.toFixed(2)}`} color="red" icon="💸" subtitle={`${gastosFiltrados.length} registros`} />
        <StatCard title="Categorias" value={String(Object.keys(porTipo).length)} color="blue" icon="📊" />
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            {TIPOS_GASTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            placeholder="Descripcion"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Monto"
            type="number"
            step="0.01"
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={guardarGasto}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExcelTable
            title="Detalle de Gastos (doble clic para editar)"
            columns={[
              { key: "fecha", label: "Fecha", type: "date", editable: true },
              { key: "tipo", label: "Tipo Gasto", editable: true },
              { key: "descripcion", label: "Descripcion", editable: true },
              { key: "monto", label: "Monto", type: "currency", editable: true },
            ]}
            data={gastosFiltrados}
            onEdit={editarCelda}
            onDelete={eliminarGasto}
          />
        </div>
        <div>
          <ExcelTable
            title="Gastos por Categoria"
            columns={[
              { key: "tipo", label: "Tipo" },
              { key: "monto", label: "Monto", type: "currency" },
              { key: "porcentaje", label: "% del Total" },
            ]}
            data={resumenTipo as Record<string, unknown>[]}
            showRowNumbers={false}
          />
        </div>
      </div>
    </div>
  )
}
