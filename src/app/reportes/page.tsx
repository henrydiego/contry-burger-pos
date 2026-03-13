"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

export default function ReportesPage() {
  const [ventas, setVentas] = useState<Record<string, unknown>[]>([])
  const [gastos, setGastos] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [ventasRes, gastosRes] = await Promise.all([
      supabase.from("ventas").select("*"),
      supabase.from("gastos").select("*"),
    ])
    setVentas(ventasRes.data || [])
    setGastos(gastosRes.data || [])
    setLoading(false)
  }

  const ventasMes = ventas.filter((v) => String(v.fecha).startsWith(filtroMes))
  const gastosMes = gastos.filter((g) => String(g.fecha).startsWith(filtroMes))

  // Ventas por producto
  const prodMap: Record<string, { producto: string; cantidad: number; ingresos: number }> = {}
  ventasMes.forEach((v) => {
    const key = String(v.producto_id || v.producto)
    if (!prodMap[key]) {
      prodMap[key] = { producto: String(v.producto), cantidad: 0, ingresos: 0 }
    }
    prodMap[key].cantidad += Number(v.cantidad) || 0
    prodMap[key].ingresos += Number(v.total) || 0
  })

  const totalIngresos = ventasMes.reduce((s, v) => s + (Number(v.total) || 0), 0)
  const ventasPorProducto = Object.values(prodMap)
    .sort((a, b) => b.ingresos - a.ingresos)
    .map((p) => ({
      ...p,
      ingresos: Number(p.ingresos.toFixed(2)),
      porcentaje: totalIngresos > 0 ? ((p.ingresos / totalIngresos) * 100).toFixed(1) + "%" : "0%",
    }))

  // Resumen financiero
  const totalGastos = gastosMes.reduce((s, g) => s + (Number(g.monto) || 0), 0)
  const ganancia = totalIngresos - totalGastos
  const margen = totalIngresos > 0 ? (ganancia / totalIngresos) * 100 : 0

  const resumenFinanciero = [
    { concepto: "Total Ventas", valor: `$${totalIngresos.toFixed(2)}` },
    { concepto: "Total Gastos", valor: `$${totalGastos.toFixed(2)}` },
    { concepto: "Ganancia Neta", valor: `$${ganancia.toFixed(2)}` },
    { concepto: "Margen Neto", valor: `${margen.toFixed(1)}%` },
  ]

  // Gastos por categoria
  const gastoPorCat: Record<string, number> = {}
  gastosMes.forEach((g) => {
    const tipo = String(g.tipo)
    gastoPorCat[tipo] = (gastoPorCat[tipo] || 0) + (Number(g.monto) || 0)
  })
  const gastosPorCategoria = Object.entries(gastoPorCat)
    .sort(([, a], [, b]) => b - a)
    .map(([tipo, monto]) => ({
      tipo,
      monto: Number(monto.toFixed(2)),
      porcentaje: totalGastos > 0 ? ((monto / totalGastos) * 100).toFixed(1) + "%" : "0%",
    }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reportes</h2>
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Ventas Mes" value={`$${totalIngresos.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Gastos Mes" value={`$${totalGastos.toFixed(2)}`} color="red" icon="💸" />
        <StatCard title="Ganancia" value={`$${ganancia.toFixed(2)}`} color={ganancia >= 0 ? "green" : "red"} icon="🏆" />
        <StatCard title="Margen" value={`${margen.toFixed(1)}%`} color="blue" icon="📊" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExcelTable
          title="Ventas por Producto"
          columns={[
            { key: "producto", label: "Producto" },
            { key: "cantidad", label: "Cant. Vendida", type: "number" },
            { key: "ingresos", label: "Ingresos", type: "currency" },
            { key: "porcentaje", label: "% del Total" },
          ]}
          data={ventasPorProducto as Record<string, unknown>[]}
          showRowNumbers={true}
        />

        <div className="space-y-6">
          <ExcelTable
            title="Resumen Financiero del Mes"
            columns={[
              { key: "concepto", label: "Concepto" },
              { key: "valor", label: "Valor" },
            ]}
            data={resumenFinanciero}
            showRowNumbers={false}
          />

          <ExcelTable
            title="Gastos por Categoria"
            columns={[
              { key: "tipo", label: "Categoria" },
              { key: "monto", label: "Monto", type: "currency" },
              { key: "porcentaje", label: "% del Total" },
            ]}
            data={gastosPorCategoria as Record<string, unknown>[]}
            showRowNumbers={false}
          />
        </div>
      </div>
    </div>
  )
}
