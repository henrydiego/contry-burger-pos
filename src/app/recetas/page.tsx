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

interface NuevoIngrediente {
  ingrediente_id: string
  ingrediente_nombre: string
  cantidad: string
  unidad: string
}

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<RecetaRow[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [ingredientes, setIngredientes] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState("")
  const [listaIngredientes, setListaIngredientes] = useState<NuevoIngrediente[]>([])
  const [ingredienteActual, setIngredienteActual] = useState("")
  const [cantidadActual, setCantidadActual] = useState("")
  const [unidadActual, setUnidadActual] = useState("kg")
  const [guardando, setGuardando] = useState(false)

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

  function agregarIngredienteALista() {
    if (!ingredienteActual || !cantidadActual) return
    const ing = ingredientes.find((i) => i.ingrediente_id === ingredienteActual)
    if (!ing) return

    // Check if already in list - if so, add to quantity
    const existente = listaIngredientes.findIndex((li) => li.ingrediente_id === ingredienteActual)
    if (existente >= 0) {
      setListaIngredientes((prev) =>
        prev.map((li, idx) =>
          idx === existente
            ? { ...li, cantidad: String((parseFloat(li.cantidad) || 0) + (parseFloat(cantidadActual) || 0)) }
            : li
        )
      )
    } else {
      setListaIngredientes((prev) => [
        ...prev,
        {
          ingrediente_id: ingredienteActual,
          ingrediente_nombre: ing.nombre,
          cantidad: cantidadActual,
          unidad: unidadActual,
        },
      ])
    }

    // Reset ingredient fields but keep product selected
    setIngredienteActual("")
    setCantidadActual("")
    setUnidadActual(ing.unidad || "kg")
  }

  function quitarDeLista(idx: number) {
    setListaIngredientes((prev) => prev.filter((_, i) => i !== idx))
  }

  function editarCantidadLista(idx: number, nuevaCantidad: string) {
    setListaIngredientes((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, cantidad: nuevaCantidad } : li))
    )
  }

  async function guardarRecetaCompleta() {
    if (!productoSeleccionado || listaIngredientes.length === 0) return
    setGuardando(true)

    const prod = productos.find((p) => p.id === productoSeleccionado)
    const rows = listaIngredientes.map((li) => ({
      producto_id: productoSeleccionado,
      ingrediente_id: li.ingrediente_id,
      producto_nombre: prod?.nombre || "",
      ingrediente_nombre: li.ingrediente_nombre,
      cantidad: parseFloat(li.cantidad) || 0,
      unidad: li.unidad,
    }))

    const { error } = await supabase.from("recetas").insert(rows)
    setGuardando(false)

    if (error) {
      alert("Error: " + error.message)
      return
    }

    // Reset builder
    setShowBuilder(false)
    setProductoSeleccionado("")
    setListaIngredientes([])
    setIngredienteActual("")
    setCantidadActual("")
    loadData()
  }

  function abrirBuilder() {
    setShowBuilder(true)
    setProductoSeleccionado("")
    setListaIngredientes([])
    setIngredienteActual("")
    setCantidadActual("")
    setUnidadActual("kg")
  }

  function editarRecetaProducto(productoId: string) {
    const prod = productos.find((p) => p.id === productoId)
    if (!prod) return
    setShowBuilder(true)
    setProductoSeleccionado(productoId)
    // Load existing ingredients for this product
    const existentes = recetas
      .filter((r) => r.producto_id === productoId)
      .map((r) => ({
        ingrediente_id: r.ingrediente_id,
        ingrediente_nombre: r.ingrediente_nombre,
        cantidad: String(r.cantidad),
        unidad: r.unidad,
      }))
    setListaIngredientes(existentes)
  }

  async function reemplazarReceta() {
    if (!productoSeleccionado || listaIngredientes.length === 0) return
    setGuardando(true)

    // Delete existing recipe for this product
    await supabase.from("recetas").delete().eq("producto_id", productoSeleccionado)

    // Insert new
    const prod = productos.find((p) => p.id === productoSeleccionado)
    const rows = listaIngredientes.map((li) => ({
      producto_id: productoSeleccionado,
      ingrediente_id: li.ingrediente_id,
      producto_nombre: prod?.nombre || "",
      ingrediente_nombre: li.ingrediente_nombre,
      cantidad: parseFloat(li.cantidad) || 0,
      unidad: li.unidad,
    }))

    const { error } = await supabase.from("recetas").insert(rows)
    setGuardando(false)

    if (error) {
      alert("Error: " + error.message)
      return
    }

    setShowBuilder(false)
    setProductoSeleccionado("")
    setListaIngredientes([])
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
  const costeoMap: Record<string, { producto: string; productoId: string; costoReceta: number; precioVenta: number }> = {}
  recetas.forEach((r) => {
    if (!costeoMap[r.producto_id]) {
      const prod = productos.find((p) => p.id === r.producto_id)
      costeoMap[r.producto_id] = {
        producto: r.producto_nombre,
        productoId: r.producto_id,
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
      productoId: data.productoId,
      costo_receta: data.costoReceta.toFixed(2),
      precio_venta: data.precioVenta.toFixed(2),
      ganancia: ganancia.toFixed(2),
      margen: margen.toFixed(1) + "%",
    }
  })

  // Products without recipe
  const productosConReceta = new Set(recetas.map((r) => r.producto_id))
  const productosSinReceta = productos.filter((p) => !productosConReceta.has(p.id))

  const productoNombre = productos.find((p) => p.id === productoSeleccionado)?.nombre || ""
  const tieneRecetaExistente = recetas.some((r) => r.producto_id === productoSeleccionado)

  // Cost preview for builder
  const costoPreview = listaIngredientes.reduce((sum, li) => {
    const ing = ingredientes.find((i) => i.ingrediente_id === li.ingrediente_id)
    return sum + (parseFloat(li.cantidad) || 0) * (Number(ing?.costo_promedio) || 0)
  }, 0)

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recetas y Costeo</h2>
        <button
          onClick={abrirBuilder}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Armar Receta
        </button>
      </div>

      {/* Products without recipe warning */}
      {productosSinReceta.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
          <p className="font-semibold text-orange-700 mb-1">Productos sin receta ({productosSinReceta.length}):</p>
          <div className="flex flex-wrap gap-2">
            {productosSinReceta.map((p) => (
              <button
                key={p.id}
                onClick={() => { abrirBuilder(); setTimeout(() => setProductoSeleccionado(p.id), 0) }}
                className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs hover:bg-orange-200 cursor-pointer"
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── BUILDER MODAL ── */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gray-800 text-white p-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-lg">
                  {tieneRecetaExistente ? "Editar Receta" : "Armar Receta Nueva"}
                </h3>
                {productoNombre && (
                  <p className="text-gray-300 text-sm">{productoNombre}</p>
                )}
              </div>
              <button
                onClick={() => setShowBuilder(false)}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Step 1: Select Product */}
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-semibold uppercase tracking-wide">
                  1. Selecciona el Producto
                </label>
                <select
                  value={productoSeleccionado}
                  onChange={(e) => {
                    setProductoSeleccionado(e.target.value)
                    // If product has existing recipe, load it
                    const existentes = recetas
                      .filter((r) => r.producto_id === e.target.value)
                      .map((r) => ({
                        ingrediente_id: r.ingrediente_id,
                        ingrediente_nombre: r.ingrediente_nombre,
                        cantidad: String(r.cantidad),
                        unidad: r.unidad,
                      }))
                    setListaIngredientes(existentes)
                  }}
                  className="w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="">-- Selecciona un producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — ${p.precio_venta.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Add Ingredients */}
              {productoSeleccionado && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1 font-semibold uppercase tracking-wide">
                      2. Agregar Ingredientes
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={ingredienteActual}
                        onChange={(e) => {
                          setIngredienteActual(e.target.value)
                          const ing = ingredientes.find((i) => i.ingrediente_id === e.target.value)
                          if (ing) setUnidadActual(ing.unidad || "kg")
                        }}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Ingrediente...</option>
                        {ingredientes.map((i) => (
                          <option key={i.ingrediente_id} value={i.ingrediente_id}>
                            {i.nombre} ({i.unidad})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="Cantidad"
                        value={cantidadActual}
                        onChange={(e) => setCantidadActual(e.target.value)}
                        className="w-24 border rounded-lg px-3 py-2 text-sm text-center"
                        onKeyDown={(e) => { if (e.key === 'Enter') agregarIngredienteALista() }}
                      />
                      <select
                        value={unidadActual}
                        onChange={(e) => setUnidadActual(e.target.value)}
                        className="w-20 border rounded-lg px-2 py-2 text-sm"
                      >
                        <option value="kg">kg</option>
                        <option value="gr">gr</option>
                        <option value="lt">lt</option>
                        <option value="ml">ml</option>
                        <option value="pz">pz</option>
                        <option value="unidades">uds</option>
                        <option value="laminas">lam</option>
                      </select>
                      <button
                        onClick={agregarIngredienteALista}
                        disabled={!ingredienteActual || !cantidadActual}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-40 whitespace-nowrap"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>

                  {/* Ingredient List */}
                  {listaIngredientes.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-2 font-semibold uppercase tracking-wide">
                        Ingredientes de la Receta ({listaIngredientes.length})
                      </label>
                      <div className="border rounded-xl overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 grid grid-cols-12 text-xs font-bold text-gray-500 uppercase">
                          <span className="col-span-5">Ingrediente</span>
                          <span className="col-span-2 text-center">Cantidad</span>
                          <span className="col-span-2 text-center">Unidad</span>
                          <span className="col-span-2 text-right">Costo</span>
                          <span className="col-span-1"></span>
                        </div>
                        {listaIngredientes.map((li, idx) => {
                          const ing = ingredientes.find((i) => i.ingrediente_id === li.ingrediente_id)
                          const costoLinea = (parseFloat(li.cantidad) || 0) * (Number(ing?.costo_promedio) || 0)
                          return (
                            <div key={idx} className="px-4 py-2 grid grid-cols-12 items-center border-t text-sm hover:bg-gray-50">
                              <span className="col-span-5 font-medium">{li.ingrediente_nombre}</span>
                              <div className="col-span-2 flex justify-center">
                                <input
                                  type="number"
                                  step="0.001"
                                  value={li.cantidad}
                                  onChange={(e) => editarCantidadLista(idx, e.target.value)}
                                  className="w-20 border rounded px-2 py-1 text-sm text-center"
                                />
                              </div>
                              <span className="col-span-2 text-center text-gray-500">{li.unidad}</span>
                              <span className="col-span-2 text-right font-semibold text-gray-700">
                                ${costoLinea.toFixed(2)}
                              </span>
                              <div className="col-span-1 text-right">
                                <button
                                  onClick={() => quitarDeLista(idx)}
                                  className="text-red-400 hover:text-red-600 font-bold"
                                >
                                  X
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {/* Cost total */}
                        <div className="bg-gray-800 text-white px-4 py-3 grid grid-cols-12 items-center">
                          <span className="col-span-9 font-bold">COSTO TOTAL DE RECETA</span>
                          <span className="col-span-2 text-right text-lg font-black">${costoPreview.toFixed(2)}</span>
                          <span className="col-span-1"></span>
                        </div>
                        {/* Margin preview */}
                        {(() => {
                          const prod = productos.find((p) => p.id === productoSeleccionado)
                          const precio = prod?.precio_venta || 0
                          const ganancia = precio - costoPreview
                          const margen = precio > 0 ? (ganancia / precio) * 100 : 0
                          return precio > 0 ? (
                            <div className="px-4 py-2 bg-gray-50 flex justify-between text-sm">
                              <span className="text-gray-500">
                                Precio Venta: <strong>${precio.toFixed(2)}</strong>
                              </span>
                              <span className={ganancia >= 0 ? "text-green-700 font-bold" : "text-red-600 font-bold"}>
                                Ganancia: ${ganancia.toFixed(2)} ({margen.toFixed(1)}%)
                              </span>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  {listaIngredientes.length > 0 && (
                    <button
                      onClick={tieneRecetaExistente ? reemplazarReceta : guardarRecetaCompleta}
                      disabled={guardando}
                      className="w-full bg-[var(--primary)] text-white py-3 rounded-xl font-black text-lg hover:bg-[var(--primary-dark)] disabled:opacity-50"
                    >
                      {guardando
                        ? "Guardando..."
                        : tieneRecetaExistente
                        ? `Actualizar Receta de ${productoNombre}`
                        : `Guardar Receta de ${productoNombre}`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Costeo Summary */}
      {costeoRows.length > 0 && (
        <div>
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
          <div className="flex flex-wrap gap-2 mt-2">
            {costeoRows.map((row) => (
              <button
                key={row.productoId}
                onClick={() => editarRecetaProducto(row.productoId)}
                className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-100 border border-blue-200"
              >
                Editar: {row.producto}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail Table */}
      <ExcelTable
        title="Detalle de Recetas (doble clic para editar cantidad)"
        columns={[
          { key: "producto_nombre", label: "Producto" },
          { key: "ingrediente_nombre", label: "Ingrediente" },
          { key: "cantidad", label: "Cantidad", type: "number", editable: true },
          { key: "unidad", label: "Unidad", editable: true },
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
