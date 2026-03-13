"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

export default function CajaPage() {
  const [cajas, setCajas] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    turno: "Matutino",
    caja_inicial: "",
    ventas_efectivo: "",
    ventas_qr: "",
    ventas_tarjeta: "",
    otros_ingresos: "",
    gastos_dia: "",
  })

  useEffect(() => {
    loadCajas()
  }, [])

  async function loadCajas() {
    const { data } = await supabase
      .from("caja_diaria")
      .select("*")
      .order("fecha", { ascending: false })
    setCajas(data || [])
    setLoading(false)
  }

  async function guardarCaja() {
    const cajaInicial = parseFloat(form.caja_inicial) || 0
    const ventasEfectivo = parseFloat(form.ventas_efectivo) || 0
    const ventasQr = parseFloat(form.ventas_qr) || 0
    const ventasTarjeta = parseFloat(form.ventas_tarjeta) || 0
    const otrosIngresos = parseFloat(form.otros_ingresos) || 0
    const gastosDia = parseFloat(form.gastos_dia) || 0
    const totalIngresos = ventasEfectivo + ventasQr + ventasTarjeta + otrosIngresos
    const cajaFinal = cajaInicial + totalIngresos - gastosDia
    const diferencia = cajaFinal - (cajaInicial + totalIngresos - gastosDia)
    const estado = diferencia === 0 ? "Cuadra" : "Descuadre"

    const { error } = await supabase.from("caja_diaria").insert({
      fecha: form.fecha,
      turno: form.turno,
      caja_inicial: cajaInicial,
      ventas_efectivo: ventasEfectivo,
      ventas_qr: ventasQr,
      ventas_tarjeta: ventasTarjeta,
      otros_ingresos: otrosIngresos,
      total_ingresos: totalIngresos,
      gastos_dia: gastosDia,
      caja_final: cajaFinal,
      diferencia: 0,
      estado,
    })
    if (error) {
      alert("Error: " + error.message)
      return
    }
    setShowForm(false)
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      turno: "Matutino",
      caja_inicial: "",
      ventas_efectivo: "",
      ventas_qr: "",
      ventas_tarjeta: "",
      otros_ingresos: "",
      gastos_dia: "",
    })
    loadCajas()
  }

  async function eliminarCaja(idx: number) {
    const caja = cajas[idx]
    if (!confirm("Eliminar registro de caja?")) return
    await supabase.from("caja_diaria").delete().eq("id", caja.id)
    loadCajas()
  }

  const totalIngresos = cajas.reduce((s, c) => s + (Number(c.total_ingresos) || 0), 0)
  const totalGastos = cajas.reduce((s, c) => s + (Number(c.gastos_dia) || 0), 0)
  const cuadran = cajas.filter((c) => Number(c.diferencia) === 0).length
  const descuadran = cajas.length - cuadran

  // Add estado display
  const cajasDisplay = cajas.map((c) => ({
    ...c,
    estado_display: Number(c.diferencia) === 0 ? "Cuadra" : "Descuadre",
  }))

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Caja Diaria</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
        >
          + Abrir/Cerrar Caja
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Ingresos" value={`$${totalIngresos.toFixed(2)}`} color="green" icon="💰" />
        <StatCard title="Total Gastos" value={`$${totalGastos.toFixed(2)}`} color="red" icon="💸" />
        <StatCard title="Cuadran" value={String(cuadran)} color="green" icon="✓" />
        <StatCard title="Descuadran" value={String(descuadran)} color={descuadran > 0 ? "red" : "green"} icon="✗" />
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-lg shadow border grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <select
            value={form.turno}
            onChange={(e) => setForm({ ...form, turno: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="Matutino">Matutino</option>
            <option value="Vespertino">Vespertino</option>
            <option value="Completo">Completo</option>
          </select>
          <input
            placeholder="Caja Inicial"
            type="number"
            step="0.01"
            value={form.caja_inicial}
            onChange={(e) => setForm({ ...form, caja_inicial: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Ventas Efectivo"
            type="number"
            step="0.01"
            value={form.ventas_efectivo}
            onChange={(e) => setForm({ ...form, ventas_efectivo: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Ventas QR"
            type="number"
            step="0.01"
            value={form.ventas_qr}
            onChange={(e) => setForm({ ...form, ventas_qr: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Ventas Tarjeta"
            type="number"
            step="0.01"
            value={form.ventas_tarjeta}
            onChange={(e) => setForm({ ...form, ventas_tarjeta: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Otros Ingresos"
            type="number"
            step="0.01"
            value={form.otros_ingresos}
            onChange={(e) => setForm({ ...form, otros_ingresos: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Gastos del Dia"
            type="number"
            step="0.01"
            value={form.gastos_dia}
            onChange={(e) => setForm({ ...form, gastos_dia: e.target.value })}
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex items-center text-sm text-gray-600 col-span-2">
            Total Ingresos: <span className="font-bold ml-1 text-green-600">
              ${(
                (parseFloat(form.ventas_efectivo) || 0) +
                (parseFloat(form.ventas_qr) || 0) +
                (parseFloat(form.ventas_tarjeta) || 0) +
                (parseFloat(form.otros_ingresos) || 0)
              ).toFixed(2)}
            </span>
            &nbsp;| Caja Final: <span className="font-bold ml-1">
              ${(
                (parseFloat(form.caja_inicial) || 0) +
                (parseFloat(form.ventas_efectivo) || 0) +
                (parseFloat(form.ventas_qr) || 0) +
                (parseFloat(form.ventas_tarjeta) || 0) +
                (parseFloat(form.otros_ingresos) || 0) -
                (parseFloat(form.gastos_dia) || 0)
              ).toFixed(2)}
            </span>
          </div>
          <button
            onClick={guardarCaja}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-green-700 col-span-2"
          >
            Guardar Caja
          </button>
        </div>
      )}

      <ExcelTable
        title="Registro de Caja Diaria"
        columns={[
          { key: "fecha", label: "Fecha", type: "date" },
          { key: "turno", label: "Turno" },
          { key: "caja_inicial", label: "Caja Inicial", type: "currency" },
          { key: "ventas_efectivo", label: "Efectivo", type: "currency" },
          { key: "ventas_qr", label: "QR", type: "currency" },
          { key: "ventas_tarjeta", label: "Tarjeta", type: "currency" },
          { key: "otros_ingresos", label: "Otros", type: "currency" },
          { key: "total_ingresos", label: "Total Ing.", type: "currency" },
          { key: "gastos_dia", label: "Gastos", type: "currency" },
          { key: "caja_final", label: "Caja Final", type: "currency" },
          { key: "diferencia", label: "Diferencia", type: "currency" },
          { key: "estado_display", label: "Estado" },
        ]}
        data={cajasDisplay}
        onDelete={eliminarCaja}
      />
    </div>
  )
}
