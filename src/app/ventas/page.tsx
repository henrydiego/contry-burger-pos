"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

interface VentaRow {
  id: number
  fecha: string
  total: number
  metodo_pago: string
  items: unknown
  items_texto: string
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<VentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState("")

  useEffect(() => {
    loadVentas()
  }, [])

  async function loadVentas() {
    const { data } = await supabase
      .from("ventas")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(200)

    const rows = (data || []).map((v) => {
      const items = typeof v.items === "string" ? JSON.parse(v.items) : v.items
      const itemsTexto = Array.isArray(items)
        ? items.map((i: { nombre?: string; cantidad?: number }) => `${i.cantidad}x ${i.nombre}`).join(", ")
        : "—"
      return { ...v, items_texto: itemsTexto }
    })

    setVentas(rows)
    setLoading(false)
  }

  const ventasFiltradas = filtroFecha
    ? ventas.filter((v) => v.fecha === filtroFecha)
    : ventas

  const totalVentas = ventasFiltradas.reduce((s, v) => s + (v.total || 0), 0)
  const efectivo = ventasFiltradas
    .filter((v) => v.metodo_pago === "efectivo")
    .reduce((s, v) => s + (v.total || 0), 0)
  const tarjeta = ventasFiltradas
    .filter((v) => v.metodo_pago === "tarjeta")
    .reduce((s, v) => s + (v.total || 0), 0)

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Historial de Ventas</h2>
        <input
          type="date"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Ventas" value={`$${totalVentas.toFixed(2)}`} color="green" icon="💰" subtitle={`${ventasFiltradas.length} transacciones`} />
        <StatCard title="Efectivo" value={`$${efectivo.toFixed(2)}`} color="blue" icon="💵" />
        <StatCard title="Tarjeta" value={`$${tarjeta.toFixed(2)}`} color="purple" icon="💳" />
      </div>

      <ExcelTable
        title="Detalle de Ventas"
        columns={[
          { key: "id", label: "ID", width: "60px" },
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "items_texto", label: "Productos Vendidos" },
          { key: "metodo_pago", label: "Metodo Pago" },
          { key: "total", label: "Total", type: "currency" },
        ]}
        data={ventasFiltradas as unknown as Record<string, unknown>[]}
      />
    </div>
  )
}
