"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ExcelTable from "@/components/ExcelTable"
import StatCard from "@/components/StatCard"

export default function CajaPage() {
  const [cajas, setCajas] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    turno: "Completo",
    caja_inicial: "",
    ventas_efectivo: "",
    ventas_qr: "",
    otros_ingresos: "",
    gastos_dia: "",
  })

  useEffect(() => { loadCajas() }, [])

  // Cuando cambia la fecha o se abre el form, calcular ventas automáticamente
  useEffect(() => {
    if (showForm) calcularVentasDia(form.fecha)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, form.fecha])

  async function loadCajas() {
    const { data } = await supabase
      .from("caja_diaria")
      .select("*")
      .order("fecha", { ascending: false })
    setCajas(data || [])
    setLoading(false)
  }

  async function calcularVentasDia(fecha: string) {
    setCalculando(true)
    // Tomar pedidos entregados del día
    const { data } = await supabase
      .from("pedidos")
      .select("total, metodo_pago")
      .eq("fecha", fecha)
      .eq("estado", "entregado")

    const efectivo = (data || [])
      .filter(p => p.metodo_pago === "efectivo")
      .reduce((s, p) => s + Number(p.total), 0)

    const qr = (data || [])
      .filter(p => p.metodo_pago === "qr")
      .reduce((s, p) => s + Number(p.total), 0)

    setForm(f => ({
      ...f,
      ventas_efectivo: efectivo > 0 ? efectivo.toFixed(2) : "",
      ventas_qr: qr > 0 ? qr.toFixed(2) : "",
    }))
    setCalculando(false)
  }

  async function guardarCaja() {
    const cajaInicial    = parseFloat(form.caja_inicial) || 0
    const ventasEfectivo = parseFloat(form.ventas_efectivo) || 0
    const ventasQr       = parseFloat(form.ventas_qr) || 0
    const otrosIngresos  = parseFloat(form.otros_ingresos) || 0
    const gastosDia      = parseFloat(form.gastos_dia) || 0
    const totalIngresos  = ventasEfectivo + ventasQr + otrosIngresos
    const cajaFinal      = cajaInicial + totalIngresos - gastosDia
    const estado         = "Cuadra"

    const { error } = await supabase.from("caja_diaria").insert({
      fecha: form.fecha,
      turno: form.turno,
      caja_inicial: cajaInicial,
      ventas_efectivo: ventasEfectivo,
      ventas_qr: ventasQr,
      ventas_tarjeta: 0,
      otros_ingresos: otrosIngresos,
      total_ingresos: totalIngresos,
      gastos_dia: gastosDia,
      caja_final: cajaFinal,
      diferencia: 0,
      estado,
    })
    if (error) { alert("Error: " + error.message); return }

    setShowForm(false)
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      turno: "Completo",
      caja_inicial: "",
      ventas_efectivo: "",
      ventas_qr: "",
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
  const totalGastos   = cajas.reduce((s, c) => s + (Number(c.gastos_dia) || 0), 0)
  const cuadran       = cajas.filter((c) => Number(c.diferencia) === 0).length
  const descuadran    = cajas.length - cuadran

  const cajasDisplay = cajas.map((c) => ({
    ...c,
    estado_display: Number(c.diferencia) === 0 ? "✅ Cuadra" : "❌ Descuadre",
  }))

  // Totales del formulario en tiempo real
  const fEfectivo = parseFloat(form.ventas_efectivo) || 0
  const fQr       = parseFloat(form.ventas_qr) || 0
  const fOtros    = parseFloat(form.otros_ingresos) || 0
  const fGastos   = parseFloat(form.gastos_dia) || 0
  const fInicial  = parseFloat(form.caja_inicial) || 0
  const fTotal    = fEfectivo + fQr + fOtros
  const fFinal    = fInicial + fTotal - fGastos

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
        <StatCard title="Total Gastos"   value={`$${totalGastos.toFixed(2)}`}   color="red"   icon="💸" />
        <StatCard title="Cuadran"        value={String(cuadran)}                color="green" icon="✓"  />
        <StatCard title="Descuadran"     value={String(descuadran)}             color={descuadran > 0 ? "red" : "green"} icon="✗" />
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Registrar Caja</h3>
            {calculando && <span className="text-xs text-blue-500 animate-pulse">Calculando ventas del día...</span>}
          </div>

          {/* Fila 1: Fecha y turno */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Turno</label>
              <select value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option>Matutino</option>
                <option>Vespertino</option>
                <option>Completo</option>
              </select>
            </div>
          </div>

          {/* Fila 2: Caja inicial y gastos (manuales) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Caja Inicial ($)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.caja_inicial}
                onChange={e => setForm({ ...form, caja_inicial: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Gastos del Día ($)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.gastos_dia}
                onChange={e => setForm({ ...form, gastos_dia: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Fila 3: Ventas auto-calculadas */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-blue-700">
              💡 Ventas calculadas automáticamente de pedidos entregados — puedes ajustar si es necesario
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ventas Efectivo ($)</label>
                <input type="number" step="0.01" placeholder="0.00" value={form.ventas_efectivo}
                  onChange={e => setForm({ ...form, ventas_efectivo: e.target.value })}
                  className="w-full border-2 border-blue-300 rounded-lg px-3 py-2 text-sm font-bold text-blue-800 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ventas QR ($)</label>
                <input type="number" step="0.01" placeholder="0.00" value={form.ventas_qr}
                  onChange={e => setForm({ ...form, ventas_qr: e.target.value })}
                  className="w-full border-2 border-blue-300 rounded-lg px-3 py-2 text-sm font-bold text-blue-800 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Otros Ingresos ($)</label>
                <input type="number" step="0.01" placeholder="0.00" value={form.otros_ingresos}
                  onChange={e => setForm({ ...form, otros_ingresos: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Ingresos</p>
              <p className="text-xl font-black text-green-600">${fTotal.toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Gastos</p>
              <p className="text-xl font-black text-red-500">${fGastos.toFixed(2)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-3">
              <p className="text-xs text-gray-400">Caja Final</p>
              <p className="text-xl font-black text-white">${fFinal.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={guardarCaja}
              className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold hover:bg-green-700 text-sm">
              💾 Guardar Caja
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ExcelTable
        title="Registro de Caja Diaria"
        columns={[
          { key: "fecha",            label: "Fecha",      type: "date"     },
          { key: "turno",            label: "Turno"                        },
          { key: "caja_inicial",     label: "Caja Ini.",  type: "currency" },
          { key: "ventas_efectivo",  label: "Efectivo",   type: "currency" },
          { key: "ventas_qr",        label: "QR",         type: "currency" },
          { key: "otros_ingresos",   label: "Otros",      type: "currency" },
          { key: "total_ingresos",   label: "Total Ing.", type: "currency" },
          { key: "gastos_dia",       label: "Gastos",     type: "currency" },
          { key: "caja_final",       label: "Caja Final", type: "currency" },
          { key: "estado_display",   label: "Estado"                       },
        ]}
        data={cajasDisplay}
        onDelete={eliminarCaja}
      />
    </div>
  )
}
