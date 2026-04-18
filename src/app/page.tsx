"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import StatCard from "@/components/StatCard"
import ExcelTable from "@/components/ExcelTable"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface DashboardData {
  ventasPosHoy: number
  ventasAppHoy: number
  ventasMes: number
  gastosMes: number
  gananciaNeta: number
  top5: Record<string, unknown>[]
  resumenFinanciero: Record<string, unknown>[]
  alertasStock: Record<string, unknown>[]
  ventasPorDia: { dia: string; total: number }[]
  gastosHoy: number
  nPedidos: number
  ticketPromedio: number
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    ventasPosHoy: 0,
    ventasAppHoy: 0,
    ventasMes: 0,
    gastosMes: 0,
    gananciaNeta: 0,
    top5: [],
    resumenFinanciero: [],
    alertasStock: [],
    ventasPorDia: [],
    gastosHoy: 0,
    nPedidos: 0,
    ticketPromedio: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const hoy = new Date().toISOString().split("T")[0]
      const mesActual = hoy.slice(0, 7)
      const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]

      const [ventasRes, gastosRes, inventarioRes, pedidosHoyRes] = await Promise.all([
        supabase.from("ventas").select("*").gte("fecha", hace7dias),
        supabase.from("gastos").select("*"),
        supabase.from("inventario").select("*"),
        supabase.from("pedidos").select("total, metodo_pago, pago_verificado, fecha").eq("fecha", hoy).eq("estado", "entregado"),
      ])

      const ventas = ventasRes.data || []
      const gastos = gastosRes.data || []
      const inventario = inventarioRes.data || []
      const pedidosHoy = pedidosHoyRes.data || []

      // POS sales (from ventas table — cashier)
      const ventasHoyArr = ventas.filter((v) => v.fecha === hoy)
      const ventasPosHoy = ventasHoyArr.reduce((s: number, v: Record<string, unknown>) => s + (Number(v.total) || 0), 0)

      // App sales (from pedidos table — online customers) — solo pago verificado
      const ventasAppHoy = pedidosHoy
        .filter((p: Record<string, unknown>) => p.metodo_pago !== "qr" || p.pago_verificado === true)
        .reduce((s: number, p: Record<string, unknown>) => s + (Number(p.total) || 0), 0)

      const ventasMesArr = ventas.filter((v) => String(v.fecha).startsWith(mesActual))
      const ventasMes = ventasMesArr.reduce((s: number, v: Record<string, unknown>) => s + (Number(v.total) || 0), 0)

      const gastosMesArr = gastos.filter((g) => String(g.fecha).startsWith(mesActual))
      const gastosMes = gastosMesArr.reduce((s: number, g: Record<string, unknown>) => s + (Number(g.monto) || 0), 0)

      const gastosHoyArr = gastos.filter((g) => String(g.fecha) === hoy)
      const gastosHoy = gastosHoyArr.reduce((s: number, g: Record<string, unknown>) => s + (Number(g.monto) || 0), 0)

      const gananciaNeta = ventasMes - gastosMes

      // Top 5 productos — combined POS + App
      const prodMap: Record<string, { producto: string; cantidad: number; total: number }> = {}
      ventas.forEach((v) => {
        const key = String(v.producto_id || v.producto)
        if (!prodMap[key]) {
          prodMap[key] = { producto: String(v.producto), cantidad: 0, total: 0 }
        }
        prodMap[key].cantidad += Number(v.cantidad) || 0
        prodMap[key].total += Number(v.total) || 0
      })
      const top5 = Object.values(prodMap)
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5)
        .map((p) => ({ ...p, total: Number(p.total.toFixed(2)) }))

      // Pedidos unicos
      const orderIds = Array.from(new Set(ventasMesArr.map((v) => v.order_id)))
      const nPedidos = orderIds.length
      const ticketPromedio = nPedidos > 0 ? ventasMes / nPedidos : 0
      const ventasMesTotal = ventasMes // ventas POS del mes (pedidos app no tienen fecha de mes aun)
      const margen = ventasMesTotal > 0 ? ((gananciaNeta / ventasMesTotal) * 100) : 0

      const resumenFinanciero = [
        { concepto: "Ventas POS Mes", valor: `Bs${ventasMes.toFixed(2)}` },
        { concepto: "Gastos Mes", valor: `Bs${gastosMes.toFixed(2)}` },
        { concepto: "Ganancia", valor: `Bs${gananciaNeta.toFixed(2)}` },
        { concepto: "Margen %", valor: `${margen.toFixed(1)}%` },
        { concepto: "N Pedidos POS", valor: String(nPedidos) },
        { concepto: "Ticket Prom.", valor: `Bs${ticketPromedio.toFixed(2)}` },
      ]

      // Alertas inventario
      const alertasStock = inventario
        .filter((i) => {
          const stockReal = (Number(i.stock_inicial) || 0) + (Number(i.total_comprado) || 0) - (Number(i.consumo_total) || 0) - (Number(i.total_merma) || 0)
          return stockReal <= (Number(i.stock_minimo) || 0)
        })
        .map((i) => {
          const stockReal = (Number(i.stock_inicial) || 0) + (Number(i.total_comprado) || 0) - (Number(i.consumo_total) || 0) - (Number(i.total_merma) || 0)
          return {
            ingrediente: i.nombre,
            stock_actual: stockReal.toFixed(2),
            stock_minimo: Number(i.stock_minimo).toFixed(2),
            unidad: i.unidad,
            alerta: stockReal <= 0 ? "SIN STOCK" : "BAJO",
          }
        })

      // Ventas por dia
      const porDia: Record<string, number> = {}
      ventas.forEach((v) => {
        porDia[v.fecha] = (porDia[v.fecha] || 0) + (Number(v.total) || 0)
      })
      const ventasPorDia = Object.entries(porDia)
        .map(([dia, total]) => ({ dia, total }))
        .sort((a, b) => a.dia.localeCompare(b.dia))

      setData({
        ventasPosHoy,
        ventasAppHoy,
        ventasMes,
        gastosMes,
        gananciaNeta,
        top5: top5 as Record<string, unknown>[],
        resumenFinanciero,
        alertasStock: alertasStock as Record<string, unknown>[],
        ventasPorDia,
        gastosHoy,
        nPedidos,
        ticketPromedio,
      })
    } catch (err) {
      console.error("Error loading dashboard:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-lg">Cargando dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard — Contry Burger</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Ventas POS Hoy" value={`Bs${data.ventasPosHoy.toFixed(2)}`} color="blue" icon="🖥️" />
        <StatCard title="Ventas App Hoy" value={`Bs${data.ventasAppHoy.toFixed(2)}`} color="green" icon="📱" />
        <StatCard title="Gastos Mes" value={`Bs${data.gastosMes.toFixed(2)}`} color="red" icon="💸" />
        <StatCard
          title="Ganancia Neta Mes"
          value={`Bs${data.gananciaNeta.toFixed(2)}`}
          color={data.gananciaNeta >= 0 ? "green" : "red"}
          icon="🏆"
        />
      </div>

      {/* Chart + Caja */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-4 border lg:col-span-2">
          <h3 className="font-semibold mb-4">Ventas Ultimos 7 Dias</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.ventasPorDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`Bs${Number(value).toFixed(2)}`, "Total"]} />
              <Bar dataKey="total" fill="#e63946" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-semibold mb-4">Resumen de Hoy</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b">
              <div>
                <span className="text-sm text-gray-700 font-medium">Ventas POS</span>
                <span className="ml-1 text-xs text-gray-400">(cajero)</span>
              </div>
              <span className="font-bold text-blue-600">Bs{data.ventasPosHoy.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <div>
                <span className="text-sm text-gray-700 font-medium">Ventas App</span>
                <span className="ml-1 text-xs text-gray-400">(clientes)</span>
              </div>
              <span className="font-bold text-purple-600">Bs{data.ventasAppHoy.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b bg-gray-50 rounded px-1">
              <span className="text-sm font-bold text-gray-800">Total Ingresos</span>
              <span className="font-bold text-green-600">${(data.ventasPosHoy + data.ventasAppHoy).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-sm text-gray-600">Gastos Hoy</span>
              <span className="font-bold text-red-500">Bs{data.gastosHoy.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold">Neto del Dia</span>
              <span className={`font-black text-lg ${(data.ventasPosHoy + data.ventasAppHoy - data.gastosHoy) >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${(data.ventasPosHoy + data.ventasAppHoy - data.gastosHoy).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 + Resumen Financiero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExcelTable
          title="Top 5 Productos Mas Vendidos"
          columns={[
            { key: "producto", label: "Producto" },
            { key: "cantidad", label: "Cant. Vendida", type: "number" },
            { key: "total", label: "Ingresos", type: "currency" },
          ]}
          data={data.top5}
          showRowNumbers={true}
        />

        <ExcelTable
          title="Resumen Financiero del Mes"
          columns={[
            { key: "concepto", label: "Concepto" },
            { key: "valor", label: "Valor" },
          ]}
          data={data.resumenFinanciero}
          showRowNumbers={false}
        />
      </div>

      {/* Alertas Stock */}
      {data.alertasStock.length > 0 && (
        <ExcelTable
          title={`Alertas de Inventario Bajo (${data.alertasStock.length})`}
          columns={[
            { key: "ingrediente", label: "Ingrediente" },
            { key: "stock_actual", label: "Stock Actual", type: "number" },
            { key: "stock_minimo", label: "Stock Minimo", type: "number" },
            { key: "unidad", label: "Unidad" },
            { key: "alerta", label: "Alerta" },
          ]}
          data={data.alertasStock}
          showRowNumbers={false}
        />
      )}
    </div>
  )
}
