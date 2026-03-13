"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"
import { Producto, Inventario } from "@/lib/types"

interface MargenRow {
  producto: string
  precio_venta: number
  costo_estimado: number
  margen_unitario: number
  margen_pct: string
  cant_vendida: number
  ventas_totales: number
  rentabilidad: string
}

export default function MargenesPage() {
  const [margenes, setMargenes] = useState<MargenRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [prodRes, recetasRes, ventasRes, ingRes] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true),
      supabase.from("recetas").select("*"),
      supabase.from("ventas").select("producto_id, cantidad, total"),
      supabase.from("inventario").select("*"),
    ])

    const productos: Producto[] = prodRes.data || []
    const recetas = recetasRes.data || []
    const ventas = ventasRes.data || []
    const ingredientes: Inventario[] = ingRes.data || []

    // Cost per product from recipes
    const costoReceta: Record<string, number> = {}
    recetas.forEach((r) => {
      const ing = ingredientes.find((i) => i.ingrediente_id === r.ingrediente_id)
      const costo = (Number(ing?.costo_promedio) || 0) * (Number(r.cantidad) || 0)
      costoReceta[r.producto_id] = (costoReceta[r.producto_id] || 0) + costo
    })

    // Sales per product
    const ventasProd: Record<string, { cantidad: number; total: number }> = {}
    ventas.forEach((v) => {
      const key = String(v.producto_id)
      if (!ventasProd[key]) ventasProd[key] = { cantidad: 0, total: 0 }
      ventasProd[key].cantidad += Number(v.cantidad) || 0
      ventasProd[key].total += Number(v.total) || 0
    })

    const rows: MargenRow[] = productos.map((p) => {
      const costoEst = costoReceta[p.id] || Number(p.costo) || 0
      const margenUnitario = p.precio_venta - costoEst
      const margenPct = p.precio_venta > 0 ? (margenUnitario / p.precio_venta) * 100 : 0
      const vp = ventasProd[p.id] || { cantidad: 0, total: 0 }

      let rentabilidad = "Bajo"
      if (margenPct > 50) rentabilidad = "Alto"
      else if (margenPct > 30) rentabilidad = "Medio"

      return {
        producto: p.nombre,
        precio_venta: p.precio_venta,
        costo_estimado: Number(costoEst.toFixed(2)),
        margen_unitario: Number(margenUnitario.toFixed(2)),
        margen_pct: margenPct.toFixed(1) + "%",
        cant_vendida: vp.cantidad,
        ventas_totales: Number(vp.total.toFixed(2)),
        rentabilidad,
      }
    })

    setMargenes(rows.sort((a, b) => b.ventas_totales - a.ventas_totales))
    setLoading(false)
  }

  const altos = margenes.filter((m) => m.rentabilidad === "Alto").length
  const medios = margenes.filter((m) => m.rentabilidad === "Medio").length
  const bajos = margenes.filter((m) => m.rentabilidad === "Bajo").length
  const totalVentas = margenes.reduce((s, m) => s + m.ventas_totales, 0)

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Analisis de Margenes</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Ventas" value={`$${totalVentas.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Rent. Alta" value={String(altos)} color="green" icon="🟢" subtitle=">50% margen" />
        <StatCard title="Rent. Media" value={String(medios)} color="yellow" icon="🟡" subtitle="30-50% margen" />
        <StatCard title="Rent. Baja" value={String(bajos)} color="red" icon="🔴" subtitle="<30% margen" />
      </div>

      <ExcelTable
        title="Margenes por Producto"
        columns={[
          { key: "producto", label: "Producto" },
          { key: "precio_venta", label: "Precio Venta", type: "currency" },
          { key: "costo_estimado", label: "Costo Estimado", type: "currency" },
          { key: "margen_unitario", label: "Margen Unit.", type: "currency" },
          { key: "margen_pct", label: "Margen %" },
          { key: "cant_vendida", label: "Cant. Vendida", type: "number" },
          { key: "ventas_totales", label: "Ventas Totales", type: "currency" },
          { key: "rentabilidad", label: "Rentabilidad" },
        ]}
        data={margenes as unknown as Record<string, unknown>[]}
        showRowNumbers={true}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Clasificacion de Rentabilidad:</p>
        <p>Alto: Margen mayor a 50% | Medio: Margen 30-50% | Bajo: Margen menor a 30%</p>
        <p>Costo Estimado se calcula desde las recetas (ingredientes x costo promedio)</p>
      </div>
    </div>
  )
}
