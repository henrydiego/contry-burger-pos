"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

interface InventarioRow {
  ingrediente_id: string
  nombre: string
  categoria: string
  stock_actual: number
  stock_inicial: number
  stock_minimo: number
  unidad: string
  total_comprado: number
  consumo_total: number
  total_merma: number
  costo_promedio: number
  stock_real: number
  alerta: string
  consumo_prom_diario: number
  dias_restantes: number
  fecha_reposicion: string
  estado_proyeccion: string
}

export default function InventarioPage() {
  const [inventario, setInventario] = useState<InventarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    ingrediente_id: "",
    nombre: "",
    categoria: "",
    stock_inicial: "",
    stock_minimo: "",
    unidad: "kg",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [invRes, ventasRes] = await Promise.all([
      supabase.from("inventario").select("*"),
      supabase.from("ventas").select("fecha").order("fecha", { ascending: true }).limit(1),
    ])

    const rawInv = invRes.data || []
    const firstSaleDate = ventasRes.data?.[0]?.fecha
    const diasOperacion = firstSaleDate
      ? Math.max(1, Math.ceil((Date.now() - new Date(firstSaleDate).getTime()) / 86400000))
      : 30

    const rows: InventarioRow[] = rawInv.map((i) => {
      const stockReal = (Number(i.stock_inicial) || 0) + (Number(i.total_comprado) || 0) - (Number(i.consumo_total) || 0) - (Number(i.total_merma) || 0)
      const consumoPromDiario = (Number(i.consumo_total) || 0) / diasOperacion
      const diasRestantes = consumoPromDiario > 0 ? stockReal / consumoPromDiario : 999
      const fechaReposicion = new Date(Date.now() + diasRestantes * 86400000).toISOString().split("T")[0]

      let alerta = "OK"
      if (stockReal <= 0) alerta = "SIN STOCK"
      else if (stockReal <= (Number(i.stock_minimo) || 0)) alerta = "BAJO"

      let estadoProyeccion = "Estable"
      if (diasRestantes <= 3) estadoProyeccion = "Critico"
      else if (diasRestantes <= 7) estadoProyeccion = "Pronto"

      return {
        ...i,
        stock_real: Number(stockReal.toFixed(2)),
        alerta,
        consumo_prom_diario: Number(consumoPromDiario.toFixed(2)),
        dias_restantes: Number(diasRestantes.toFixed(0)),
        fecha_reposicion: diasRestantes < 365 ? fechaReposicion : "N/A",
        estado_proyeccion: estadoProyeccion,
      }
    })

    setInventario(rows)
    setLoading(false)
  }

  async function guardarInventario() {
    const { error } = await supabase.from("inventario").insert({
      ingrediente_id: form.ingrediente_id,
      nombre: form.nombre,
      categoria: form.categoria,
      stock_inicial: parseFloat(form.stock_inicial) || 0,
      stock_actual: parseFloat(form.stock_inicial) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      unidad: form.unidad,
      total_comprado: 0,
      consumo_total: 0,
      total_merma: 0,
      costo_promedio: 0,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({ ingrediente_id: "", nombre: "", categoria: "", stock_inicial: "", stock_minimo: "", unidad: "kg" })
    loadData()
  }

  async function editarCelda(rowIdx: number, key: string, value: string) {
    const item = inventario[rowIdx]
    const updateData: Record<string, unknown> = {}
    if (["stock_actual", "stock_inicial", "stock_minimo", "total_comprado", "consumo_total", "total_merma", "costo_promedio"].includes(key)) {
      updateData[key] = parseFloat(value) || 0
    } else {
      updateData[key] = value
    }
    await supabase.from("inventario").update(updateData).eq("ingrediente_id", item.ingrediente_id)
    loadData()
  }

  async function eliminarInventario(idx: number) {
    const item = inventario[idx]
    if (!confirm(`Eliminar "${item.nombre}"?`)) return
    const { error } = await supabase.from("inventario").delete().eq("ingrediente_id", item.ingrediente_id)
    if (error) {
      alert(`No se pudo eliminar "${item.nombre}".\n\nMotivo: ${error.message}\n\nSi este ingrediente está en una receta, primero elimínalo de Recetas.`)
      return
    }
    loadData()
  }

  const alertas = inventario.filter((i) => i.alerta !== "OK")
  const sinStock = inventario.filter((i) => i.alerta === "SIN STOCK").length
  const bajo = inventario.filter((i) => i.alerta === "BAJO").length

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inventario</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Agregar Ingrediente
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Items" value={String(inventario.length)} color="blue" icon="📋" />
        <StatCard title="Stock Bajo" value={String(bajo)} color="yellow" icon="⚠️" />
        <StatCard title="Sin Stock" value={String(sinStock)} color="red" icon="🚫" />
      </div>

      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 font-semibold text-sm">
            Alertas de Stock ({alertas.length}):
          </p>
          <ul className="text-red-600 text-xs mt-1 space-y-0.5">
            {alertas.map((a) => (
              <li key={a.ingrediente_id}>
                {a.nombre}: {a.stock_real} {a.unidad} (min: {a.stock_minimo}) — {a.alerta}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-7 gap-3">
          <input
            placeholder="ID (ej: ING001)"
            value={form.ingrediente_id}
            onChange={(e) => setForm({ ...form, ingrediente_id: e.target.value })}
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
            placeholder="Stock Inicial"
            type="number"
            value={form.stock_inicial}
            onChange={(e) => setForm({ ...form, stock_inicial: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Stock Minimo"
            type="number"
            value={form.stock_minimo}
            onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
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
            <option value="gr">Gramos</option>
            <option value="ml">Mililitros</option>
          </select>
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
          { key: "ingrediente_id", label: "ID", width: "80px" },
          { key: "nombre", label: "Nombre", editable: true },
          { key: "categoria", label: "Categoria", editable: true },
          { key: "stock_real", label: "Stock Real", type: "number" },
          { key: "stock_minimo", label: "Stock Min.", type: "number", editable: true },
          { key: "unidad", label: "Unidad" },
          { key: "alerta", label: "Alerta" },
        ]}
        data={inventario as unknown as Record<string, unknown>[]}
        onEdit={editarCelda}
        onDelete={eliminarInventario}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Formula Stock Real:</p>
        <p>Stock Real = Stock Inicial + Total Comprado - Consumo Total - Total Merma</p>
      </div>

      <ExcelTable
        title="Proyeccion de Inventario"
        columns={[
          { key: "ingrediente_id", label: "ID", width: "80px" },
          { key: "nombre", label: "Ingrediente" },
          { key: "consumo_prom_diario", label: "Consumo Prom/Dia", type: "number" },
          { key: "dias_restantes", label: "Dias Restantes", type: "number" },
          { key: "fecha_reposicion", label: "Fecha Reposicion" },
          { key: "estado_proyeccion", label: "Estado" },
        ]}
        data={inventario as unknown as Record<string, unknown>[]}
        showRowNumbers={false}
      />
    </div>
  )
}
