"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface HoraRow {
  hora: string
  franja: string
  ventas: number
  transacciones: number
  ticket_promedio: number
  clasificacion: string
}

function getFranja(hora: number): string {
  if (hora >= 7 && hora < 10) return "Desayuno"
  if (hora >= 10 && hora < 12) return "Manana"
  if (hora >= 12 && hora < 15) return "Almuerzo"
  if (hora >= 15 && hora < 18) return "Tarde"
  if (hora >= 18 && hora < 21) return "Cena"
  return "Noche"
}

export default function HorasPicoPage() {
  const [horasData, setHorasData] = useState<HoraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data } = await supabase.from("ventas").select("order_id, hora, total, fecha")
    const ventas = data || []

    // Group by hour
    const porHora: Record<string, { ventas: number; orderIds: Set<string> }> = {}

    for (let h = 8; h <= 23; h++) {
      const key = String(h).padStart(2, "0") + ":00"
      porHora[key] = { ventas: 0, orderIds: new Set() }
    }

    ventas.forEach((v) => {
      if (filtroFecha && v.fecha !== filtroFecha) return
      const horaStr = String(v.hora || "").slice(0, 2)
      const horaNum = parseInt(horaStr)
      if (isNaN(horaNum) || horaNum < 8 || horaNum > 23) return
      const key = String(horaNum).padStart(2, "0") + ":00"
      if (!porHora[key]) porHora[key] = { ventas: 0, orderIds: new Set() }
      porHora[key].ventas += Number(v.total) || 0
      porHora[key].orderIds.add(String(v.order_id))
    })

    // Find average to determine pico vs media
    const values = Object.values(porHora).map((v) => v.ventas)
    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0

    const rows: HoraRow[] = Object.entries(porHora).map(([hora, info]) => {
      const horaNum = parseInt(hora)
      const transacciones = info.orderIds.size
      return {
        hora,
        franja: getFranja(horaNum),
        ventas: Number(info.ventas.toFixed(2)),
        transacciones,
        ticket_promedio: transacciones > 0 ? Number((info.ventas / transacciones).toFixed(2)) : 0,
        clasificacion: info.ventas > avg && info.ventas > 0 ? "HORA PICO" : "MEDIA",
      }
    })

    setHorasData(rows)
    setLoading(false)
  }

  // Reload when filter changes
  useEffect(() => {
    if (!loading) {
      setLoading(true)
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroFecha])

  const horaPico = horasData.reduce((max, h) => h.ventas > max.ventas ? h : max, horasData[0] || { hora: "-", ventas: 0 })
  const totalVentas = horasData.reduce((s, h) => s + h.ventas, 0)
  const totalTransacciones = horasData.reduce((s, h) => s + h.transacciones, 0)
  const picoCount = horasData.filter((h) => h.clasificacion === "HORA PICO").length

  const chartData = horasData.map((h) => ({
    hora: h.hora,
    ventas: h.ventas,
  }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Horas Pico</h2>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Hora Pico" value={horaPico?.hora || "-"} color="red" icon="🔥" subtitle={`Bs${(horaPico?.ventas || 0).toFixed(2)}`} />
        <StatCard title="Total Ventas" value={`Bs${totalVentas.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Transacciones" value={String(totalTransacciones)} color="blue" icon="🧾" />
        <StatCard title="Horas Pico" value={String(picoCount)} color="purple" icon="📈" subtitle="arriba del promedio" />
      </div>

      <div className="bg-white rounded-lg shadow p-4 border">
        <h3 className="font-semibold mb-4">Ventas por Hora</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`Bs${Number(value).toFixed(2)}`, "Ventas"]} />
            <Bar dataKey="ventas" fill="#e63946" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ExcelTable
        title="Detalle por Hora"
        columns={[
          { key: "hora", label: "Hora" },
          { key: "franja", label: "Franja" },
          { key: "ventas", label: "Ventas", type: "currency" },
          { key: "transacciones", label: "Transacciones", type: "number" },
          { key: "ticket_promedio", label: "Ticket Prom.", type: "currency" },
          { key: "clasificacion", label: "Clasificacion" },
        ]}
        data={horasData as unknown as Record<string, unknown>[]}
        showRowNumbers={false}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Franjas Horarias:</p>
        <p>Desayuno: 7-10 | Manana: 10-12 | Almuerzo: 12-15 | Tarde: 15-18 | Cena: 18-21 | Noche: 21+</p>
        <p>HORA PICO = ventas por encima del promedio de todas las horas</p>
      </div>
    </div>
  )
}
