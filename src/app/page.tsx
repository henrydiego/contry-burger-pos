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
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface DashboardData {
  ventasHoy: number
  ventasSemana: number
  comprasHoy: number
  mermaHoy: number
  productosActivos: number
  alertasStock: number
  ventasRecientes: Record<string, unknown>[]
  ventasPorDia: { dia: string; total: number }[]
  ventasPorCategoria: { name: string; value: number }[]
}

const COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#e9c46a", "#e76f51"]

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    ventasHoy: 0,
    ventasSemana: 0,
    comprasHoy: 0,
    mermaHoy: 0,
    productosActivos: 0,
    alertasStock: 0,
    ventasRecientes: [],
    ventasPorDia: [],
    ventasPorCategoria: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const hoy = new Date().toISOString().split("T")[0]
      const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]

      const [ventasRes, comprasRes, mermaRes, productosRes, inventarioRes] =
        await Promise.all([
          supabase.from("ventas").select("*").gte("fecha", hace7dias).order("fecha", { ascending: false }),
          supabase.from("compras").select("*").eq("fecha", hoy),
          supabase.from("merma").select("*").eq("fecha", hoy),
          supabase.from("productos").select("*").eq("activo", true),
          supabase.from("inventario").select("*, producto:productos(nombre)"),
        ])

      const ventas = ventasRes.data || []
      const ventasHoy = ventas
        .filter((v) => v.fecha === hoy)
        .reduce((s, v) => s + (v.total || 0), 0)
      const ventasSemana = ventas.reduce((s, v) => s + (v.total || 0), 0)
      const comprasHoy = (comprasRes.data || []).reduce((s, c) => s + (c.total || 0), 0)
      const mermaHoy = (mermaRes.data || []).reduce((s, m) => s + (m.costo_perdida || 0), 0)

      const alertas = (inventarioRes.data || []).filter(
        (i) => i.cantidad <= i.stock_minimo
      )

      // Ventas por dia
      const porDia: Record<string, number> = {}
      ventas.forEach((v) => {
        porDia[v.fecha] = (porDia[v.fecha] || 0) + (v.total || 0)
      })
      const ventasPorDia = Object.entries(porDia)
        .map(([dia, total]) => ({ dia, total }))
        .sort((a, b) => a.dia.localeCompare(b.dia))

      // Ventas por categoria (from items)
      const catMap: Record<string, number> = {}
      ventas.forEach((v) => {
        const items = typeof v.items === "string" ? JSON.parse(v.items) : v.items
        if (Array.isArray(items)) {
          items.forEach((item: { nombre?: string; subtotal?: number }) => {
            const cat = item.nombre || "Otros"
            catMap[cat] = (catMap[cat] || 0) + (item.subtotal || 0)
          })
        }
      })
      const ventasPorCategoria = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)

      setData({
        ventasHoy,
        ventasSemana,
        comprasHoy,
        mermaHoy,
        productosActivos: (productosRes.data || []).length,
        alertasStock: alertas.length,
        ventasRecientes: ventas.slice(0, 10) as Record<string, unknown>[],
        ventasPorDia,
        ventasPorCategoria,
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Ventas Hoy" value={`$${data.ventasHoy.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Ventas Semana" value={`$${data.ventasSemana.toFixed(2)}`} color="blue" icon="📈" />
        <StatCard title="Compras Hoy" value={`$${data.comprasHoy.toFixed(2)}`} color="purple" icon="🛒" />
        <StatCard title="Merma Hoy" value={`$${data.mermaHoy.toFixed(2)}`} color="red" icon="⚠️" />
        <StatCard title="Productos" value={String(data.productosActivos)} color="blue" icon="📦" />
        <StatCard
          title="Alertas Stock"
          value={String(data.alertasStock)}
          color={data.alertasStock > 0 ? "red" : "green"}
          icon="🔔"
          subtitle={data.alertasStock > 0 ? "Stock bajo" : "OK"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-semibold mb-4">Ventas Ultimos 7 Dias</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.ventasPorDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Total"]} />
              <Bar dataKey="total" fill="#e63946" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-semibold mb-4">Ventas por Producto</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.ventasPorCategoria}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {data.ventasPorCategoria.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Sales Table */}
      <ExcelTable
        title="Ventas Recientes"
        columns={[
          { key: "id", label: "ID", width: "60px" },
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "total", label: "Total", type: "currency" },
          { key: "metodo_pago", label: "Metodo Pago" },
        ]}
        data={data.ventasRecientes}
      />
    </div>
  )
}
