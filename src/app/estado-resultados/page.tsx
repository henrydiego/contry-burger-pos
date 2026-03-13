"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

export default function EstadoResultadosPage() {
  const [ventas, setVentas] = useState<Record<string, unknown>[]>([])
  const [gastos, setGastos] = useState<Record<string, unknown>[]>([])
  const [recetas, setRecetas] = useState<Record<string, unknown>[]>([])
  const [ingredientes, setIngredientes] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [ventasRes, gastosRes, recetasRes, ingRes] = await Promise.all([
      supabase.from("ventas").select("*"),
      supabase.from("gastos").select("*"),
      supabase.from("recetas").select("*"),
      supabase.from("inventario").select("*"),
    ])
    setVentas(ventasRes.data || [])
    setGastos(gastosRes.data || [])
    setRecetas(recetasRes.data || [])
    setIngredientes(ingRes.data || [])
    setLoading(false)
  }

  // Cost per product from recipes
  const costoReceta: Record<string, number> = {}
  recetas.forEach((r) => {
    const ing = ingredientes.find((i) => i.ingrediente_id === r.ingrediente_id)
    const costo = (Number(ing?.costo_promedio) || 0) * (Number(r.cantidad) || 0)
    const prodId = String(r.producto_id)
    costoReceta[prodId] = (costoReceta[prodId] || 0) + costo
  })

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]

  const ventasAnio = ventas.filter((v) => String(v.fecha).startsWith(String(anio)))
  const gastosAnio = gastos.filter((g) => String(g.fecha).startsWith(String(anio)))

  const estadoMensual = meses.map((mes, idx) => {
    const mesStr = String(idx + 1).padStart(2, "0")
    const prefix = `${anio}-${mesStr}`

    const ventasMes = ventasAnio.filter((v) => String(v.fecha).startsWith(prefix))
    const gastosMes = gastosAnio.filter((g) => String(g.fecha).startsWith(prefix))

    const totalVentas = ventasMes.reduce((s, v) => s + (Number(v.total) || 0), 0)

    // Cost of goods sold
    let costoVentas = 0
    ventasMes.forEach((v) => {
      const prodId = String(v.producto_id)
      const costoUnit = costoReceta[prodId] || 0
      costoVentas += costoUnit * (Number(v.cantidad) || 0)
    })

    const utilidadBruta = totalVentas - costoVentas
    const margenBruto = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0

    const gastosOperativos = gastosMes.reduce((s, g) => s + (Number(g.monto) || 0), 0)
    const utilidadNeta = utilidadBruta - gastosOperativos
    const margenNeto = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : 0

    return {
      mes,
      ventas: Number(totalVentas.toFixed(2)),
      costo_ventas: Number(costoVentas.toFixed(2)),
      utilidad_bruta: Number(utilidadBruta.toFixed(2)),
      margen_bruto: margenBruto.toFixed(1) + "%",
      gastos_operativos: Number(gastosOperativos.toFixed(2)),
      utilidad_neta: Number(utilidadNeta.toFixed(2)),
      margen_neto: margenNeto.toFixed(1) + "%",
    }
  })

  // Annual totals
  const totalAnual = {
    mes: "TOTAL ANUAL",
    ventas: estadoMensual.reduce((s, m) => s + m.ventas, 0),
    costo_ventas: estadoMensual.reduce((s, m) => s + m.costo_ventas, 0),
    utilidad_bruta: estadoMensual.reduce((s, m) => s + m.utilidad_bruta, 0),
    margen_bruto: "",
    gastos_operativos: estadoMensual.reduce((s, m) => s + m.gastos_operativos, 0),
    utilidad_neta: estadoMensual.reduce((s, m) => s + m.utilidad_neta, 0),
    margen_neto: "",
  }
  totalAnual.margen_bruto = totalAnual.ventas > 0
    ? ((totalAnual.utilidad_bruta / totalAnual.ventas) * 100).toFixed(1) + "%"
    : "0%"
  totalAnual.margen_neto = totalAnual.ventas > 0
    ? ((totalAnual.utilidad_neta / totalAnual.ventas) * 100).toFixed(1) + "%"
    : "0%"

  const roi = totalAnual.gastos_operativos > 0
    ? ((totalAnual.utilidad_neta / totalAnual.gastos_operativos) * 100).toFixed(1)
    : "0"

  // Expense breakdown
  const gastosPorCat: Record<string, number> = {}
  gastosAnio.forEach((g) => {
    const tipo = String(g.tipo)
    gastosPorCat[tipo] = (gastosPorCat[tipo] || 0) + (Number(g.monto) || 0)
  })
  const totalGastosAnio = Object.values(gastosPorCat).reduce((s, v) => s + v, 0)
  const desglose = Object.entries(gastosPorCat)
    .sort(([, a], [, b]) => b - a)
    .map(([tipo, monto]) => ({
      tipo,
      monto: Number(monto.toFixed(2)),
      porcentaje: totalGastosAnio > 0 ? ((monto / totalGastosAnio) * 100).toFixed(1) + "%" : "0%",
    }))

  // Key indicators
  const indicadores = [
    { indicador: "Ventas Totales", valor: `$${totalAnual.ventas.toFixed(2)}` },
    { indicador: "Costo de Ventas", valor: `$${totalAnual.costo_ventas.toFixed(2)}` },
    { indicador: "Utilidad Bruta", valor: `$${totalAnual.utilidad_bruta.toFixed(2)}` },
    { indicador: "Margen Bruto", valor: totalAnual.margen_bruto },
    { indicador: "Gastos Operativos", valor: `$${totalAnual.gastos_operativos.toFixed(2)}` },
    { indicador: "Utilidad Neta", valor: `$${totalAnual.utilidad_neta.toFixed(2)}` },
    { indicador: "Margen Neto", valor: totalAnual.margen_neto },
    { indicador: "ROI", valor: `${roi}%` },
  ]

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Estado de Resultados</h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setAnio(anio - 1)}
            className="border rounded px-3 py-2 text-sm hover:bg-gray-100"
          >
            &lt;
          </button>
          <span className="font-bold text-lg">{anio}</span>
          <button
            onClick={() => setAnio(anio + 1)}
            className="border rounded px-3 py-2 text-sm hover:bg-gray-100"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Ventas Anuales" value={`$${totalAnual.ventas.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Utilidad Neta" value={`$${totalAnual.utilidad_neta.toFixed(2)}`} color={totalAnual.utilidad_neta >= 0 ? "green" : "red"} icon="🏆" />
        <StatCard title="Margen Neto" value={totalAnual.margen_neto} color="blue" icon="📊" />
        <StatCard title="ROI" value={`${roi}%`} color="purple" icon="📈" />
      </div>

      <ExcelTable
        title={`Estado de Resultados Mensual — ${anio}`}
        columns={[
          { key: "mes", label: "Mes" },
          { key: "ventas", label: "Ventas", type: "currency" },
          { key: "costo_ventas", label: "Costo Ventas", type: "currency" },
          { key: "utilidad_bruta", label: "Util. Bruta", type: "currency" },
          { key: "margen_bruto", label: "Margen Bruto" },
          { key: "gastos_operativos", label: "Gastos Op.", type: "currency" },
          { key: "utilidad_neta", label: "Util. Neta", type: "currency" },
          { key: "margen_neto", label: "Margen Neto" },
        ]}
        data={[...estadoMensual, totalAnual] as Record<string, unknown>[]}
        showRowNumbers={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExcelTable
          title="Indicadores Clave"
          columns={[
            { key: "indicador", label: "Indicador" },
            { key: "valor", label: "Valor" },
          ]}
          data={indicadores}
          showRowNumbers={false}
        />

        <ExcelTable
          title="Desglose de Gastos"
          columns={[
            { key: "tipo", label: "Categoria" },
            { key: "monto", label: "Monto", type: "currency" },
            { key: "porcentaje", label: "% del Total" },
          ]}
          data={desglose as Record<string, unknown>[]}
          showRowNumbers={false}
        />
      </div>
    </div>
  )
}
