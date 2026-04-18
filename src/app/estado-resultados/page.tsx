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

  useEffect(() => { loadData() }, [])

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

  // Costo por producto desde recetas
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

  // Categorias fijas vs variables
  const CATS_FIJAS = ["Personal", "Servicios", "Alquiler"]

  const estadoMensual = meses.map((mes, idx) => {
    const mesStr = String(idx + 1).padStart(2, "0")
    const prefix = `${anio}-${mesStr}`

    const ventasMes = ventasAnio.filter((v) => String(v.fecha).startsWith(prefix))
    const gastosMes = gastosAnio.filter((g) => String(g.fecha).startsWith(prefix))

    const totalVentas = ventasMes.reduce((s, v) => s + (Number(v.total) || 0), 0)

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

  // ROI = Utilidad Neta / Gastos Operativos (retorno sobre cada $ gastado en operacion)
  const roi = totalAnual.gastos_operativos > 0
    ? ((totalAnual.utilidad_neta / totalAnual.gastos_operativos) * 100).toFixed(1)
    : "0"

  // Desglose de gastos (fix: usar categoria en lugar de tipo)
  const gastosPorCat: Record<string, number> = {}
  gastosAnio.forEach((g) => {
    const cat = String(g.categoria || g.tipo || "Sin categoria")
    gastosPorCat[cat] = (gastosPorCat[cat] || 0) + (Number(g.monto) || 0)
  })
  const totalGastosAnio = Object.values(gastosPorCat).reduce((s, v) => s + v, 0)
  const desglose = Object.entries(gastosPorCat)
    .sort(([, a], [, b]) => b - a)
    .map(([tipo, monto]) => ({
      tipo,
      fijo_variable: CATS_FIJAS.includes(tipo) ? "Fijo" : "Variable",
      monto: Number(monto.toFixed(2)),
      porcentaje: totalGastosAnio > 0 ? ((monto / totalGastosAnio) * 100).toFixed(1) + "%" : "0%",
    }))

  // ── PUNTO DE EQUILIBRIO ──
  const mesActual = new Date().getMonth() // 0-indexed
  const mesActualStr = String(mesActual + 1).padStart(2, "0")
  const prefixMesActual = `${anio}-${mesActualStr}`

  const ventasMesActual = ventasAnio.filter(v => String(v.fecha).startsWith(prefixMesActual))
  const gastosMesActual = gastosAnio.filter(g => String(g.fecha).startsWith(prefixMesActual))

  const ventasMesActualTotal = ventasMesActual.reduce((s, v) => s + (Number(v.total) || 0), 0)

  let costoVentasMesActual = 0
  ventasMesActual.forEach((v) => {
    const prodId = String(v.producto_id)
    costoVentasMesActual += (costoReceta[prodId] || 0) * (Number(v.cantidad) || 0)
  })

  // Costos fijos del mes actual (Personal, Servicios, Alquiler)
  const costosFijos = gastosMesActual
    .filter(g => CATS_FIJAS.includes(String(g.categoria || g.tipo || "")))
    .reduce((s, g) => s + (Number(g.monto) || 0), 0)

  // Costos variables del mes actual (todo lo demas en gastos + costo ingredientes)
  const gastosVariables = gastosMesActual
    .filter(g => !CATS_FIJAS.includes(String(g.categoria || g.tipo || "")))
    .reduce((s, g) => s + (Number(g.monto) || 0), 0)

  const totalCostosVariables = costoVentasMesActual + gastosVariables

  // Margen de contribucion = (Ventas - Costos Variables) / Ventas
  const margenContribucion = ventasMesActualTotal > 0
    ? (ventasMesActualTotal - totalCostosVariables) / ventasMesActualTotal
    : 0

  // Punto de equilibrio en ingresos
  const puntoEquilibrio = margenContribucion > 0
    ? costosFijos / margenContribucion
    : 0

  const superaPE = ventasMesActualTotal >= puntoEquilibrio && puntoEquilibrio > 0
  const pctHaciaPE = puntoEquilibrio > 0
    ? Math.min((ventasMesActualTotal / puntoEquilibrio) * 100, 100)
    : 0
  const faltaParaPE = Math.max(puntoEquilibrio - ventasMesActualTotal, 0)

  // Indicadores clave
  const indicadores = [
    { indicador: "Ventas Totales Año", valor: `Bs${totalAnual.ventas.toFixed(2)}` },
    { indicador: "Costo de Ventas", valor: `Bs${totalAnual.costo_ventas.toFixed(2)}` },
    { indicador: "Utilidad Bruta", valor: `Bs${totalAnual.utilidad_bruta.toFixed(2)}` },
    { indicador: "Margen Bruto", valor: totalAnual.margen_bruto },
    { indicador: "Gastos Operativos", valor: `Bs${totalAnual.gastos_operativos.toFixed(2)}` },
    { indicador: "Utilidad Neta", valor: `Bs${totalAnual.utilidad_neta.toFixed(2)}` },
    { indicador: "Margen Neto", valor: totalAnual.margen_neto },
    { indicador: "ROI (retorno s/gastos)", valor: `${roi}%` },
  ]

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Estado de Resultados</h2>
        <div className="flex gap-2 items-center">
          <button onClick={() => setAnio(anio - 1)} className="border rounded px-3 py-2 text-sm hover:bg-gray-100">&lt;</button>
          <span className="font-bold text-lg">{anio}</span>
          <button onClick={() => setAnio(anio + 1)} className="border rounded px-3 py-2 text-sm hover:bg-gray-100">&gt;</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Ventas Anuales" value={`Bs${totalAnual.ventas.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Utilidad Neta" value={`Bs${totalAnual.utilidad_neta.toFixed(2)}`} color={totalAnual.utilidad_neta >= 0 ? "green" : "red"} icon="🏆" />
        <StatCard title="Margen Neto" value={totalAnual.margen_neto} color="blue" icon="📊" />
        <StatCard title="ROI" value={`${roi}%`} color="purple" icon="📈" />
      </div>

      {/* ── PUNTO DE EQUILIBRIO ── */}
      <div className="bg-white rounded-xl border shadow p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Punto de Equilibrio — {meses[mesActual]}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cuanto necesitas vender para cubrir todos tus costos fijos del mes
            </p>
          </div>
          {puntoEquilibrio > 0 && (
            <span className={`text-sm font-black px-3 py-1 rounded-full ${superaPE ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {superaPE ? "✅ Superado" : "⚠️ En camino"}
            </span>
          )}
        </div>

        {costosFijos === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 space-y-1">
            <p className="font-bold">Para calcular el Punto de Equilibrio necesitas registrar tus costos fijos:</p>
            <p>Ve a <strong>Caja Diaria → Registrar Gasto</strong> y usa estas categorias:</p>
            <ul className="list-disc ml-4 space-y-0.5 mt-1">
              <li><strong>Personal</strong> — sueldos, adelantos a empleados</li>
              <li><strong>Servicios</strong> — luz, agua, internet, gas</li>
              <li><strong>Alquiler</strong> — renta del local</li>
            </ul>
            <p className="mt-2 text-xs text-yellow-700">El sistema distingue costos fijos (Personal/Servicios/Alquiler) de variables (Proveedor/Operacion) para calcular el margen real.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Barra de progreso */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Ventas actuales: <strong className="text-green-700">Bs{ventasMesActualTotal.toFixed(2)}</strong></span>
                <span className="text-gray-600">Equilibrio: <strong className="text-orange-700">Bs{puntoEquilibrio.toFixed(2)}</strong></span>
              </div>
              <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${superaPE ? "bg-green-500" : "bg-orange-400"}`}
                  style={{ width: `${pctHaciaPE}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>$0</span>
                <span className="font-semibold text-gray-600">{pctHaciaPE.toFixed(0)}% alcanzado</span>
                <span>Bs{puntoEquilibrio.toFixed(2)}</span>
              </div>
            </div>

            {/* Cards de datos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Costos Fijos</p>
                <p className="text-lg font-black text-red-600">Bs{costosFijos.toFixed(2)}</p>
                <p className="text-xs text-gray-400">Personal, Alquiler, Servicios</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Costos Variables</p>
                <p className="text-lg font-black text-orange-600">Bs{totalCostosVariables.toFixed(2)}</p>
                <p className="text-xs text-gray-400">Ingredientes + Operacion</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Margen Contribucion</p>
                <p className="text-lg font-black text-blue-600">{(margenContribucion * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-400">Por cada $1 vendido</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${superaPE ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-100"}`}>
                <p className="text-xs text-gray-500">{superaPE ? "Ganancia s/equilibrio" : "Falta para equilibrio"}</p>
                <p className={`text-lg font-black ${superaPE ? "text-green-600" : "text-yellow-600"}`}>
                  ${superaPE ? (ventasMesActualTotal - puntoEquilibrio).toFixed(2) : faltaParaPE.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">{superaPE ? "Ya estas en ganancia" : "Ventas que faltan"}</p>
              </div>
            </div>

            {/* Explicacion */}
            <div className="bg-gray-50 border rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <p><strong>Como leerlo:</strong> Con ${costosFijos.toFixed(2)} de costos fijos y un margen de {(margenContribucion * 100).toFixed(1)}%,
                necesitas vender <strong>Bs{puntoEquilibrio.toFixed(2)}</strong> este mes para no perder dinero.</p>
              {!superaPE && faltaParaPE > 0 && (
                <p>Te faltan <strong>Bs{faltaParaPE.toFixed(2)}</strong> en ventas. Cada venta adicional
                  te genera <strong>${(margenContribucion).toFixed(2)} centavos de contribucion</strong> para cubrir costos fijos.</p>
              )}
              {superaPE && (
                <p>¡Superaste el equilibrio! Todo lo que vendas de mas genera ganancia neta directa.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabla mensual */}
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
          title="Indicadores Clave del Año"
          columns={[
            { key: "indicador", label: "Indicador" },
            { key: "valor", label: "Valor" },
          ]}
          data={indicadores}
          showRowNumbers={false}
        />

        <ExcelTable
          title="Desglose de Gastos por Categoria"
          columns={[
            { key: "tipo", label: "Categoria" },
            { key: "fijo_variable", label: "Tipo" },
            { key: "monto", label: "Monto", type: "currency" },
            { key: "porcentaje", label: "% del Total" },
          ]}
          data={desglose as Record<string, unknown>[]}
          showRowNumbers={false}
        />
      </div>

      {/* Explicacion ROI */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800 space-y-1">
        <p className="font-bold">¿Que significa el ROI ({roi}%)?</p>
        <p>
          El ROI aqui mide el <strong>retorno sobre tus gastos operativos</strong>:
          por cada $100 que gastas en operacion, generas ${(parseFloat(roi) || 0).toFixed(0)} de utilidad neta.
        </p>
        <p className="text-xs text-purple-600 mt-1">
          Si esta en cero es porque aun no tienes gastos registrados o las ventas no cubren los costos.
          El ROI clasico (vs inversion inicial del negocio) requiere ingresar el capital inicial invertido.
        </p>
      </div>
    </div>
  )
}
