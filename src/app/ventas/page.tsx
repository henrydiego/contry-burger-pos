"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

export default function VentasPage() {
  const [ventas, setVentas] = useState<Record<string, unknown>[]>([])
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
      .limit(500)
    setVentas(data || [])
    setLoading(false)
  }

  const ventasFiltradas = filtroFecha
    ? ventas.filter((v) => v.fecha === filtroFecha)
    : ventas

  const totalVentas = ventasFiltradas.reduce((s, v) => s + (Number(v.total) || 0), 0)
  const efectivo = ventasFiltradas
    .filter((v) => v.metodo_pago === "efectivo")
    .reduce((s, v) => s + (Number(v.total) || 0), 0)
  const tarjeta = ventasFiltradas
    .filter((v) => v.metodo_pago === "tarjeta")
    .reduce((s, v) => s + (Number(v.total) || 0), 0)
  const qr = ventasFiltradas
    .filter((v) => v.metodo_pago === "qr")
    .reduce((s, v) => s + (Number(v.total) || 0), 0)

  const orderIds = Array.from(new Set(ventasFiltradas.map((v) => v.order_id)))
  const nPedidos = orderIds.length
  const ticketPromedio = nPedidos > 0 ? totalVentas / nPedidos : 0

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Historial de Ventas</h2>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          {filtroFecha && (
            <button
              onClick={() => setFiltroFecha("")}
              className="text-sm text-gray-500 hover:text-red-500"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Ventas" value={`$${totalVentas.toFixed(2)}`} color="green" icon="💰" subtitle={`${ventasFiltradas.length} lineas`} />
        <StatCard title="N Pedidos" value={String(nPedidos)} color="blue" icon="🧾" />
        <StatCard title="Ticket Prom." value={`$${ticketPromedio.toFixed(2)}`} color="purple" icon="📊" />
        <StatCard title="Efectivo" value={`$${efectivo.toFixed(2)}`} color="green" icon="💵" />
        <StatCard title="Tarjeta + QR" value={`$${(tarjeta + qr).toFixed(2)}`} color="blue" icon="💳" />
      </div>

      <ExcelTable
        title="Detalle de Ventas (cada linea = 1 producto vendido)"
        columns={[
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "order_id", label: "ORDER_ID", width: "90px" },
          { key: "producto_id", label: "Prod. ID", width: "80px" },
          { key: "producto", label: "Producto" },
          { key: "categoria", label: "Categoria" },
          { key: "cantidad", label: "Cant.", type: "number" },
          { key: "precio_unitario", label: "P. Unit.", type: "currency" },
          { key: "total", label: "Total", type: "currency" },
          { key: "metodo_pago", label: "Metodo Pago" },
          { key: "cajero", label: "Cajero" },
          { key: "estado", label: "Estado" },
          { key: "hora", label: "Hora" },
        ]}
        data={ventasFiltradas}
      />
    </div>
  )
}
