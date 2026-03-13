"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import { Producto, Inventario } from "@/lib/types"

interface RecetaRow {
  id: string
  producto_id: string
  ingrediente_id: string
  producto_nombre: string
  ingrediente_nombre: string
  cantidad: number
  unidad: string
  costo_ingrediente: number
  costo_linea: number
}

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [ingredientes, setIngredientes] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    producto_id: "",
    ingrediente_id: "",
    cantidad: "",
    unidad: "kg",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [recRes, prodRes, ingRes] = await Promise.all([
      supabase.from("recetas").select("*"),
      supabase.from("productos").select("*").eq("activo", true),
      supabase.from("inventario").select("*"),
    ])

    const rawRecetas = recRes.data || []
    const prods = prodRes.data || []
    const ings = ingRes.data || []

    setProductos(prods)
    setIngredientes(ings)

    const rows: RecetaRow[] = rawRecetas.map((r) => {
      const ing = ings.find((i: Inventario) => i.ingrediente_id === r.ingrediente_id)
      const costoPromedio = Number(ing?.costo_promedio) || 0
      const cantidad = Number(r.cantidad) || 0
      return {
        id: r.id,
        producto_id: r.producto_id,
        ingrediente_id: r.ingrediente_id,
        producto_nombre: r.producto_nombre || "",
        ingrediente_nombre: r.ingrediente_nombre || "",
        cantidad,
        unidad: r.unidad,
        costo_ingrediente: costoPromedio,
        costo_linea: Number((costoPromedio * cantidad).toFixed(2)),
      }
    })

    setRecetas(rows)
    setLoading(false)
  }

  async function guardarReceta() {
    const prod = productos.find((p) => p.id === form.producto_id)
    const ing = ingredientes.find((i) => i.ingrediente_id === form.ingrediente_id)

    const { error } = await supabase.from("recetas").insert({
      producto_id: form.producto_id,
      ingrediente_id: form.ingrediente_id,
      producto_nombre: prod?.nombre || "",
      ingrediente_nombre: ing?.nombre || "",
      cantidad: parseFloat(form.cantidad) || 0,
      unidad: form.unidad,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({ producto_id: "", ingrediente_id: "", cantidad: "", unidad: "kg" })
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
    if (key === "cantidad") {
      updateData[key] = parseFloat(value) || 0
    } else {
      updateData[key] = value
    }
    await supabase.from("recetas").update(updateData).eq("id", receta.id)
    loadData()
  }

  // Costeo summary per product
  const costeoMap: Record<string, { producto: string; costoReceta: number; precioVenta: number }> = {}
  recetas.forEach((r) => {
    if (!costeoMap[r.producto_id]) {
      const prod = productos.find((p) => p.id === r.producto_id)
      costeoMap[r.producto_id] = {
        producto: r.producto_nombre,
        costoReceta: 0,
        precioVenta: prod?.precio_venta || 0,
      }
    }
    costeoMap[r.producto_id].costoReceta += r.costo_linea
  })

  const costeoRows = Object.entries(costeoMap).map(([, data]) => {
    const ganancia = data.precioVenta - data.costoReceta
    const margen = data.precioVenta > 0 ? (ganancia / data.precioVenta) * 100 : 0
    return {
      producto: data.producto,
      costo_receta: data.costoReceta.toFixed(2),
      precio_venta: data.precioVenta.toFixed(2),
      ganancia: ganancia.toFixed(2),
      margen: margen.toFixed(1) + "%",
    }
  })

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recetas y Costeo</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Agregar Ingrediente a Receta
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <select
            value={form.ingrediente_id}
            onChange={(e) => {
              const ing = ingredientes.find((i) => i.ingrediente_id === e.target.value)
              setForm({ ...form, ingrediente_id: e.target.value, unidad: ing?.unidad || "kg" })
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Ingrediente</option>
            {ingredientes.map((i) => (
              <option key={i.ingrediente_id} value={i.ingrediente_id}>
                {i.nombre} ({i.unidad})
              </option>
            ))}
          </select>
          <input
            placeholder="Cantidad"
            type="number"
            step="0.001"
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
          <button
            onClick={guardarReceta}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700"
          >
            Guardar
          </button>
        </div>
      )}

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

      <ExcelTable
        title="Detalle de Recetas (doble clic para editar cantidad)"
        columns={[
          { key: "producto_nombre", label: "Producto" },
          { key: "ingrediente_nombre", label: "Ingrediente" },
          { key: "cantidad", label: "Cantidad", type: "number", editable: true },
          { key: "unidad", label: "Unidad" },
          { key: "costo_ingrediente", label: "Costo/Unid", type: "currency" },
          { key: "costo_linea", label: "Costo Linea", type: "currency" },
        ]}
        data={recetas as unknown as Record<string, unknown>[]}
        onEdit={editarCelda}
        onDelete={eliminarReceta}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Calculo de Costeo:</p>
        <p>Costo Linea = Costo Promedio del Ingrediente (inventario) x Cantidad en Receta</p>
        <p>Costo Receta = Suma de todos los Costos Linea del producto</p>
      </div>
    </div>
  )
}
