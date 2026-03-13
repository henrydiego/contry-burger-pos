"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"
import { Inventario } from "@/lib/types"

export default function MermaPage() {
  const [merma, setMerma] = useState<Record<string, unknown>[]>([])
  const [ingredientes, setIngredientes] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [mermaId, setMermaId] = useState("")
  const [form, setForm] = useState({
    ingrediente_id: "",
    cantidad_perdida: "",
    motivo: "Producto vencido",
    responsable: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  const generateMermaId = useCallback(async () => {
    const { data } = await supabase
      .from("merma")
      .select("merma_id")
      .order("id", { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      const last = String(data[0].merma_id || "MER000")
      const num = parseInt(last.replace("MER", "")) || 0
      return `MER${String(num + 1).padStart(3, "0")}`
    }
    return "MER001"
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [mermaRes, ingRes] = await Promise.all([
      supabase.from("merma").select("*").order("fecha", { ascending: false }),
      supabase.from("inventario").select("*"),
    ])
    setMerma(mermaRes.data || [])
    setIngredientes(ingRes.data || [])
    const newId = await generateMermaId()
    setMermaId(newId)
    setLoading(false)
  }

  async function guardarMerma() {
    const ing = ingredientes.find((i) => i.ingrediente_id === form.ingrediente_id)
    const cantidadPerdida = parseFloat(form.cantidad_perdida) || 0
    const costoUnitario = Number(ing?.costo_promedio) || 0
    const costoMerma = cantidadPerdida * costoUnitario

    const { error } = await supabase.from("merma").insert({
      merma_id: mermaId,
      ingrediente_id: form.ingrediente_id,
      ingrediente: ing?.nombre || "",
      cantidad_perdida: cantidadPerdida,
      unidad: ing?.unidad || "kg",
      motivo: form.motivo,
      costo_unitario: costoUnitario,
      costo_merma: Number(costoMerma.toFixed(2)),
      responsable: form.responsable,
      fecha: form.fecha,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }

    // Update inventario.total_merma
    if (ing) {
      const nuevaTotalMerma = (Number(ing.total_merma) || 0) + cantidadPerdida
      await supabase
        .from("inventario")
        .update({ total_merma: nuevaTotalMerma })
        .eq("ingrediente_id", form.ingrediente_id)
    }

    setShowForm(false)
    setForm({
      ingrediente_id: "",
      cantidad_perdida: "",
      motivo: "Producto vencido",
      responsable: "",
      fecha: new Date().toISOString().split("T")[0],
    })
    loadData()
  }

  async function eliminarMerma(idx: number) {
    const item = merma[idx]
    if (!confirm("Eliminar registro de merma?")) return
    await supabase.from("merma").delete().eq("id", item.id)
    loadData()
  }

  const totalMerma = merma.reduce((s, m) => s + (Number(m.costo_merma) || 0), 0)
  const mesActual = new Date().toISOString().slice(0, 7)
  const mermaMes = merma
    .filter((m) => String(m.fecha).startsWith(mesActual))
    .reduce((s, m) => s + (Number(m.costo_merma) || 0), 0)

  // Monthly summary by motivo
  const mermaMesArr = merma.filter((m) => String(m.fecha).startsWith(mesActual))
  const resumenMotivo: Record<string, { motivo: string; cantidad: number; costo: number }> = {}
  mermaMesArr.forEach((m) => {
    const key = String(m.motivo)
    if (!resumenMotivo[key]) {
      resumenMotivo[key] = { motivo: key, cantidad: 0, costo: 0 }
    }
    resumenMotivo[key].cantidad += Number(m.cantidad_perdida) || 0
    resumenMotivo[key].costo += Number(m.costo_merma) || 0
  })
  const resumenRows = Object.values(resumenMotivo).map((r) => ({
    ...r,
    costo: Number(r.costo.toFixed(2)),
  }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Control de Merma</h2>
          <p className="text-sm text-gray-500">Proxima merma: <span className="font-bold">{mermaId}</span></p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Registrar Merma
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Merma Total" value={`$${totalMerma.toFixed(2)}`} color="red" icon="📉" />
        <StatCard title="Merma Este Mes" value={`$${mermaMes.toFixed(2)}`} color="yellow" icon="⚠️" />
        <StatCard title="Registros Mes" value={String(mermaMesArr.length)} color="blue" icon="📋" />
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            value={form.ingrediente_id}
            onChange={(e) => setForm({ ...form, ingrediente_id: e.target.value })}
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
            placeholder="Cantidad perdida"
            type="number"
            step="0.01"
            value={form.cantidad_perdida}
            onChange={(e) => setForm({ ...form, cantidad_perdida: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <select
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="Producto vencido">Producto vencido</option>
            <option value="Producto quemado">Producto quemado</option>
            <option value="Error de cocina">Error de cocina</option>
          </select>
          <input
            placeholder="Responsable"
            value={form.responsable}
            onChange={(e) => setForm({ ...form, responsable: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="border rounded px-3 py-2 text-sm flex-1"
            />
            <button
              onClick={guardarMerma}
              className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExcelTable
            title="Registro de Merma"
            columns={[
              { key: "merma_id", label: "Merma ID", width: "80px" },
              { key: "fecha", label: "Fecha", type: "date" },
              { key: "ingrediente", label: "Ingrediente" },
              { key: "cantidad_perdida", label: "Cantidad", type: "number" },
              { key: "unidad", label: "Unidad" },
              { key: "motivo", label: "Motivo" },
              { key: "costo_unitario", label: "C. Unit.", type: "currency" },
              { key: "costo_merma", label: "Costo Merma", type: "currency" },
              { key: "responsable", label: "Responsable" },
            ]}
            data={merma}
            onDelete={eliminarMerma}
          />
        </div>
        <div>
          <ExcelTable
            title="Resumen Mensual por Motivo"
            columns={[
              { key: "motivo", label: "Motivo" },
              { key: "cantidad", label: "Cant.", type: "number" },
              { key: "costo", label: "Costo", type: "currency" },
            ]}
            data={resumenRows as Record<string, unknown>[]}
            showRowNumbers={false}
          />
        </div>
      </div>
    </div>
  )
}
