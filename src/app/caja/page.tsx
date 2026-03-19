"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import html2canvas from "html2canvas"

interface CajaHoy {
  id: number
  fecha: string
  turno: string
  cajero: string | null
  hora_apertura: string | null
  hora_cierre: string | null
  caja_inicial: number
  ventas_pos_efectivo: number
  ventas_pos_qr: number
  ventas_app_efectivo: number
  ventas_app_qr: number
  ventas_efectivo: number
  ventas_qr: number
  ventas_tarjeta: number
  otros_ingresos: number
  total_ingresos: number
  gastos_dia: number
  caja_final: number
  efectivo_contado: number | null
  diferencia: number
  estado: string
}

interface GastoCaja {
  id: number
  concepto: string
  monto: number
  fecha: string
  categoria: string
  comprobante?: string
}

export default function CajaPage() {
  const hoy = new Date().toISOString().split("T")[0]
  const [cajaHoy, setCajaHoy] = useState<CajaHoy | null>(null)
  const [historial, setHistorial] = useState<CajaHoy[]>([])
  const [gastosHoy, setGastosHoy] = useState<GastoCaja[]>([])
  const [ventasPosHoy, setVentasPosHoy] = useState({ efectivo: 0, qr: 0, tarjeta: 0 })
  const [ventasAppHoy, setVentasAppHoy] = useState({ efectivo: 0, qr: 0 })
  const [loading, setLoading] = useState(true)

  // Formularios
  const [showAbrirForm, setShowAbrirForm] = useState(false)
  const [showCerrarForm, setShowCerrarForm] = useState(false)
  const [showGastoForm, setShowGastoForm] = useState(false)
  const [showArqueo, setShowArqueo] = useState<CajaHoy | null>(null)

  const [formApertura, setFormApertura] = useState({ cajero: "", caja_inicial: "" })
  const [formCierre, setFormCierre] = useState({ efectivo_contado: "", otros_ingresos: "" })
  const [formGasto, setFormGasto] = useState({ concepto: "", monto: "", comprobante: "", categoria: "Operacion" })
  const [guardando, setGuardando] = useState(false)
  const [guardandoImg, setGuardandoImg] = useState(false)

  useEffect(() => { loadTodo() }, [])

  async function loadTodo() {
    const [cajaRes, histRes, gastosRes, ventasPosRes, pedidosRes] = await Promise.all([
      supabase.from("caja_diaria").select("*").eq("fecha", hoy).limit(1),
      supabase.from("caja_diaria").select("*").order("fecha", { ascending: false }).limit(30),
      supabase.from("gastos").select("*").eq("fecha", hoy),
      supabase.from("ventas").select("metodo_pago, total").eq("fecha", hoy),
      supabase.from("pedidos").select("metodo_pago, total").eq("fecha", hoy).eq("estado", "entregado"),
    ])

    const caja = cajaRes.data?.[0] || null
    setCajaHoy(caja as CajaHoy | null)
    setHistorial((histRes.data || []) as CajaHoy[])
    setGastosHoy((gastosRes.data || []) as GastoCaja[])

    // Calcular ventas POS
    const vPos = (ventasPosRes.data || []).reduce(
      (acc, v) => {
        const total = Number(v.total) || 0
        if (v.metodo_pago === "efectivo") acc.efectivo += total
        else if (v.metodo_pago === "qr") acc.qr += total
        else if (v.metodo_pago === "tarjeta") acc.tarjeta += total
        return acc
      },
      { efectivo: 0, qr: 0, tarjeta: 0 }
    )
    setVentasPosHoy(vPos)

    // Calcular ventas App
    const vApp = (pedidosRes.data || []).reduce(
      (acc, p) => {
        const total = Number(p.total) || 0
        if (p.metodo_pago === "efectivo") acc.efectivo += total
        else acc.qr += total
        return acc
      },
      { efectivo: 0, qr: 0 }
    )
    setVentasAppHoy(vApp)

    setLoading(false)
  }

  async function abrirCaja() {
    if (!formApertura.cajero.trim()) { alert("Ingresa el nombre del cajero"); return }
    setGuardando(true)
    // Verificación doble: evitar abrir caja dos veces el mismo día
    const { data: existente } = await supabase.from("caja_diaria").select("id").eq("fecha", hoy).limit(1)
    if (existente && existente.length > 0) {
      setGuardando(false)
      setShowAbrirForm(false)
      loadTodo()
      return
    }
    const hora = new Date().toTimeString().split(" ")[0]
    const { error } = await supabase.from("caja_diaria").insert({
      fecha: hoy,
      turno: "Completo",
      cajero: formApertura.cajero.trim(),
      hora_apertura: hora,
      caja_inicial: parseFloat(formApertura.caja_inicial) || 0,
      ventas_efectivo: 0, ventas_qr: 0, ventas_tarjeta: 0,
      otros_ingresos: 0, total_ingresos: 0, gastos_dia: 0,
      caja_final: parseFloat(formApertura.caja_inicial) || 0,
      diferencia: 0, estado: "Abierta",
    })
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setShowAbrirForm(false)
    setFormApertura({ cajero: "", caja_inicial: "" })
    loadTodo()
  }

  async function cerrarCaja() {
    if (!cajaHoy) return
    setGuardando(true)
    const hora = new Date().toTimeString().split(" ")[0]
    const totalPos = ventasPosHoy.efectivo + ventasPosHoy.qr + ventasPosHoy.tarjeta
    const totalApp = ventasAppHoy.efectivo + ventasAppHoy.qr
    const totalIngresos = totalPos + totalApp + (parseFloat(formCierre.otros_ingresos) || 0)
    const totalGastos = gastosHoy.reduce((s, g) => s + g.monto, 0)
    const cajaFinal = (cajaHoy.caja_inicial || 0) + totalIngresos - totalGastos
    const efectivoContado = parseFloat(formCierre.efectivo_contado) || 0
    const efectivoSistema = (cajaHoy.caja_inicial || 0) + ventasPosHoy.efectivo + ventasAppHoy.efectivo - totalGastos
    const diferencia = efectivoContado - efectivoSistema

    const { error } = await supabase.from("caja_diaria").update({
      hora_cierre: hora,
      ventas_pos_efectivo: ventasPosHoy.efectivo,
      ventas_pos_qr: ventasPosHoy.qr,
      ventas_app_efectivo: ventasAppHoy.efectivo,
      ventas_app_qr: ventasAppHoy.qr,
      ventas_efectivo: ventasPosHoy.efectivo + ventasAppHoy.efectivo,
      ventas_qr: ventasPosHoy.qr + ventasAppHoy.qr,
      ventas_tarjeta: ventasPosHoy.tarjeta,
      otros_ingresos: parseFloat(formCierre.otros_ingresos) || 0,
      total_ingresos: totalIngresos,
      gastos_dia: totalGastos,
      caja_final: cajaFinal,
      efectivo_contado: efectivoContado,
      diferencia,
      estado: "Cerrada",
    }).eq("id", cajaHoy.id)

    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setShowCerrarForm(false)
    setFormCierre({ efectivo_contado: "", otros_ingresos: "" })
    loadTodo()
  }

  async function agregarGasto() {
    if (!formGasto.concepto.trim() || !formGasto.monto) return
    setGuardando(true)
    const conceptoFull = formGasto.comprobante
      ? `[Comp. #${formGasto.comprobante}] ${formGasto.concepto.trim()}`
      : formGasto.concepto.trim()
    const { error } = await supabase.from("gastos").insert({
      concepto: conceptoFull,
      monto: parseFloat(formGasto.monto),
      fecha: hoy,
      categoria: formGasto.categoria,
    })
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setFormGasto({ concepto: "", monto: "", comprobante: "", categoria: "Operacion" })
    setShowGastoForm(false)
    loadTodo()
  }

  async function guardarArqueoImagen(caja: CajaHoy) {
    setGuardandoImg(true)
    try {
      const el = document.getElementById("arqueo-print-area")
      if (!el) return
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 })
      const link = document.createElement("a")
      link.download = `arqueo-caja-${caja.fecha}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (e) {
      console.error(e)
    } finally {
      setGuardandoImg(false)
    }
  }

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando caja...</div>

  const totalPosHoy = ventasPosHoy.efectivo + ventasPosHoy.qr + ventasPosHoy.tarjeta
  const totalAppHoy = ventasAppHoy.efectivo + ventasAppHoy.qr
  const totalIngresosHoy = totalPosHoy + totalAppHoy
  const totalGastosHoy = gastosHoy.reduce((s, g) => s + g.monto, 0)
  const netoHoy = totalIngresosHoy - totalGastosHoy

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #arqueo-print-area, #arqueo-print-area * { visibility: visible !important; }
          #arqueo-print-area {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 90mm !important; padding: 6mm !important; font-size: 10px !important;
          }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Caja Diaria</h2>
          <p className="text-sm text-gray-500">{hoy}</p>
        </div>
        {cajaHoy?.estado === "Abierta" && (
          <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-sm animate-pulse">
            🟢 Caja Abierta — {cajaHoy.cajero || cajaHoy.turno}
          </span>
        )}
        {cajaHoy?.estado === "Cerrada" && (
          <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full text-sm">
            🔴 Caja Cerrada
          </span>
        )}
      </div>

      {/* ── PANEL DE HOY ── */}
      {!cajaHoy ? (
        /* Sin caja hoy */
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center space-y-4">
          <p className="text-5xl">🏧</p>
          <p className="text-xl font-bold text-gray-700">La caja no ha sido abierta hoy</p>
          <p className="text-sm text-gray-500">Abre la caja para comenzar a registrar ventas y gastos del dia</p>
          <button
            onClick={() => setShowAbrirForm(true)}
            className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-green-700"
          >
            Abrir Caja del Dia
          </button>
        </div>
      ) : cajaHoy.estado === "Abierta" ? (
        /* Caja abierta — panel en vivo */
        <div className="space-y-4">
          {/* Resumen de ventas */}
          <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Ventas del Dia (en vivo)</h3>
              <span className="text-xs text-gray-400">Apertura: {cajaHoy.hora_apertura}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* POS */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-blue-700 uppercase">Ventas POS (cajero)</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Efectivo</span>
                  <span className="font-bold">${ventasPosHoy.efectivo.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">QR / Digital</span>
                  <span className="font-bold">${ventasPosHoy.qr.toFixed(2)}</span>
                </div>
                {ventasPosHoy.tarjeta > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tarjeta</span>
                    <span className="font-bold">${ventasPosHoy.tarjeta.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-blue-700 border-t border-blue-200 pt-1">
                  <span>Subtotal POS</span>
                  <span>${totalPosHoy.toFixed(2)}</span>
                </div>
              </div>

              {/* App */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-purple-700 uppercase">Ventas App (clientes)</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Efectivo</span>
                  <span className="font-bold">${ventasAppHoy.efectivo.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">QR / Digital</span>
                  <span className="font-bold">${ventasAppHoy.qr.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-purple-700 border-t border-purple-200 pt-1">
                  <span>Subtotal App</span>
                  <span>${totalAppHoy.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Totales */}
            <div className="bg-gray-900 text-white rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Total Ingresos</p>
                <p className="text-xl font-black text-green-400">${totalIngresosHoy.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Gastos del Dia</p>
                <p className="text-xl font-black text-red-400">${totalGastosHoy.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Neto</p>
                <p className={`text-xl font-black ${netoHoy >= 0 ? "text-white" : "text-red-400"}`}>${netoHoy.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Gastos del dia */}
          <div className="bg-white rounded-2xl border shadow p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Gastos / Egresos ({gastosHoy.length})</h3>
              <button
                onClick={() => setShowGastoForm(!showGastoForm)}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                + Registrar Gasto
              </button>
            </div>

            {showGastoForm && (
              <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Concepto</label>
                    <input
                      type="text" placeholder="ej: Pago Coca-Cola"
                      value={formGasto.concepto}
                      onChange={e => setFormGasto(f => ({ ...f, concepto: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Monto ($)</label>
                    <input
                      type="number" step="0.01" placeholder="0.00"
                      value={formGasto.monto}
                      onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">N° Comprobante (opcional)</label>
                    <input
                      type="text" placeholder="ej: 100, Fact-023"
                      value={formGasto.comprobante}
                      onChange={e => setFormGasto(f => ({ ...f, comprobante: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Categoria</label>
                    <select
                      value={formGasto.categoria}
                      onChange={e => setFormGasto(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option>Operacion</option>
                      <option>Proveedor</option>
                      <option>Personal</option>
                      <option>Servicios</option>
                      <option>Otro</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={agregarGasto} disabled={guardando || !formGasto.concepto || !formGasto.monto}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50">
                    {guardando ? "..." : "Guardar Gasto"}
                  </button>
                  <button onClick={() => setShowGastoForm(false)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {gastosHoy.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin gastos registrados hoy</p>
            ) : (
              <div className="divide-y">
                {gastosHoy.map(g => (
                  <div key={g.id} className="flex justify-between items-center py-2 text-sm">
                    <div>
                      <p className="font-medium">{g.concepto}</p>
                      <p className="text-xs text-gray-400">{g.categoria}</p>
                    </div>
                    <span className="font-bold text-red-600">${g.monto.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-black pt-2">
                  <span>Total Gastos</span>
                  <span className="text-red-600">${totalGastosHoy.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Cerrar caja */}
          <div className="bg-white rounded-2xl border shadow p-5 space-y-3">
            <h3 className="font-bold text-gray-800">Cierre de Caja</h3>
            <p className="text-sm text-gray-500">Cuenta el efectivo fisico en caja y registra el cierre del dia.</p>

            {!showCerrarForm ? (
              <button
                onClick={() => setShowCerrarForm(true)}
                className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900"
              >
                Cerrar Caja del Dia
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm space-y-1">
                  <p className="font-bold text-blue-700">Efectivo en sistema:</p>
                  <p className="text-gray-700">
                    Caja inicial ${(cajaHoy.caja_inicial || 0).toFixed(2)} +
                    Efectivo POS ${ventasPosHoy.efectivo.toFixed(2)} +
                    Efectivo App ${ventasAppHoy.efectivo.toFixed(2)} -
                    Gastos ${totalGastosHoy.toFixed(2)} =
                    <strong> ${((cajaHoy.caja_inicial || 0) + ventasPosHoy.efectivo + ventasAppHoy.efectivo - totalGastosHoy).toFixed(2)}</strong>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Efectivo contado fisicamente ($)</label>
                    <input
                      type="number" step="0.01" placeholder="0.00"
                      value={formCierre.efectivo_contado}
                      onChange={e => setFormCierre(f => ({ ...f, efectivo_contado: e.target.value }))}
                      className="w-full border-2 border-gray-800 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Otros ingresos no registrados ($)</label>
                    <input
                      type="number" step="0.01" placeholder="0.00"
                      value={formCierre.otros_ingresos}
                      onChange={e => setFormCierre(f => ({ ...f, otros_ingresos: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                {formCierre.efectivo_contado && (
                  <div className={`rounded-xl p-3 text-sm font-bold text-center ${
                    Math.abs(parseFloat(formCierre.efectivo_contado) - ((cajaHoy.caja_inicial || 0) + ventasPosHoy.efectivo + ventasAppHoy.efectivo - totalGastosHoy)) < 0.01
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    Diferencia: ${(parseFloat(formCierre.efectivo_contado) - ((cajaHoy.caja_inicial || 0) + ventasPosHoy.efectivo + ventasAppHoy.efectivo - totalGastosHoy)).toFixed(2)}
                    {Math.abs(parseFloat(formCierre.efectivo_contado) - ((cajaHoy.caja_inicial || 0) + ventasPosHoy.efectivo + ventasAppHoy.efectivo - totalGastosHoy)) < 0.01
                      ? " ✅ Cuadra perfectamente"
                      : " ⚠️ Hay descuadre"}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={cerrarCaja} disabled={guardando}
                    className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900 disabled:opacity-50">
                    {guardando ? "Cerrando..." : "Confirmar Cierre"}
                  </button>
                  <button onClick={() => setShowCerrarForm(false)} className="px-5 border rounded-xl text-gray-600 hover:bg-gray-50 text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Caja cerrada hoy */
        <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800">Caja cerrada</h3>
              <p className="text-xs text-gray-500">
                Apertura: {cajaHoy.hora_apertura || "–"} | Cierre: {cajaHoy.hora_cierre || "–"} | Cajero: {cajaHoy.cajero || cajaHoy.turno}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-200">
                🖨️ Imprimir Arqueo
              </button>
              <button
                onClick={() => { setShowArqueo(cajaHoy); setTimeout(() => guardarArqueoImagen(cajaHoy), 300) }}
                disabled={guardandoImg}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {guardandoImg ? "..." : "💾 Guardar PNG"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Ingresos</p>
              <p className="text-xl font-black text-green-700">${(cajaHoy.total_ingresos || 0).toFixed(2)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Gastos</p>
              <p className="text-xl font-black text-red-600">${(cajaHoy.gastos_dia || 0).toFixed(2)}</p>
            </div>
            <div className={`rounded-xl p-3 ${(cajaHoy.diferencia || 0) === 0 ? "bg-gray-900" : "bg-red-700"}`}>
              <p className="text-xs text-gray-400">Diferencia</p>
              <p className="text-xl font-black text-white">${(cajaHoy.diferencia || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className={`text-center font-bold py-2 rounded-xl text-sm ${(cajaHoy.diferencia || 0) === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {(cajaHoy.diferencia || 0) === 0 ? "✅ Caja Cuadra Perfectamente" : `⚠️ Descuadre de $${Math.abs(cajaHoy.diferencia || 0).toFixed(2)}`}
          </div>
        </div>
      )}

      {/* Formulario Abrir Caja */}
      {showAbrirForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-xl font-black text-gray-800">Abrir Caja</h3>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre del cajero / responsable</label>
              <input
                type="text" placeholder="ej: Juan Perez"
                value={formApertura.cajero}
                onChange={e => setFormApertura(f => ({ ...f, cajero: e.target.value }))}
                className="w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-green-500"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monto inicial en caja (efectivo fisico)</label>
              <input
                type="number" step="0.01" placeholder="0.00"
                value={formApertura.caja_inicial}
                onChange={e => setFormApertura(f => ({ ...f, caja_inicial: e.target.value }))}
                className="w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
              <p>Se registrara: <strong>{new Date().toLocaleTimeString("es-MX")}</strong></p>
              <p>Fecha: <strong>{hoy}</strong></p>
            </div>
            <div className="flex gap-3">
              <button onClick={abrirCaja} disabled={guardando || !formApertura.cajero.trim()}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black hover:bg-green-700 disabled:opacity-50">
                {guardando ? "Abriendo..." : "Abrir Caja"}
              </button>
              <button onClick={() => setShowAbrirForm(false)} className="px-5 border rounded-xl text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arqueo imprimible (oculto, solo para captura) */}
      {showArqueo && (
        <div id="arqueo-print-area" className="fixed top-0 left-0 bg-white p-6 font-mono text-xs w-80 z-[-1]">
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
            <p className="text-lg font-black">CONTRY BURGER</p>
            <p className="text-xs">ARQUEO DE CAJA</p>
            <p className="mt-1">Fecha: {showArqueo.fecha}</p>
            <p>Cajero: {showArqueo.cajero || showArqueo.turno}</p>
            <p>Apertura: {showArqueo.hora_apertura || "–"} | Cierre: {showArqueo.hora_cierre || "–"}</p>
          </div>
          <div className="space-y-1 border-b border-dashed border-gray-400 pb-3 mb-3">
            <p className="font-bold">INGRESOS:</p>
            <div className="flex justify-between"><span>Caja inicial</span><span>${(showArqueo.caja_inicial || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Ventas POS efectivo</span><span>${(showArqueo.ventas_pos_efectivo || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Ventas POS QR</span><span>${(showArqueo.ventas_pos_qr || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Ventas App efectivo</span><span>${(showArqueo.ventas_app_efectivo || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Ventas App QR</span><span>${(showArqueo.ventas_app_qr || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Otros ingresos</span><span>${(showArqueo.otros_ingresos || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t border-gray-400 pt-1"><span>TOTAL INGRESOS</span><span>${(showArqueo.total_ingresos || 0).toFixed(2)}</span></div>
          </div>
          <div className="space-y-1 border-b border-dashed border-gray-400 pb-3 mb-3">
            <div className="flex justify-between"><span>Gastos del dia</span><span>-${(showArqueo.gastos_dia || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold"><span>CAJA FINAL SISTEMA</span><span>${(showArqueo.caja_final || 0).toFixed(2)}</span></div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Efectivo contado</span><span>${(showArqueo.efectivo_contado || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-black border-t-2 border-gray-800 pt-1">
              <span>DIFERENCIA</span>
              <span>${(showArqueo.diferencia || 0).toFixed(2)}</span>
            </div>
            <p className="text-center font-bold mt-2">
              {(showArqueo.diferencia || 0) === 0 ? "✅ CUADRA" : "⚠️ DESCUADRE"}
            </p>
          </div>
          <div className="text-center mt-4 border-t border-dashed border-gray-400 pt-3 text-xs text-gray-500">
            <p>Firma cajero: ___________________</p>
            <p className="mt-2">Firma supervisor: _______________</p>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      <div className="bg-white rounded-2xl border shadow overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Historial (ultimos 30 dias)</h3>
          <span className="text-sm text-gray-500">{historial.length} registros</span>
        </div>
        {historial.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Sin registros</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Cajero</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500">Ingresos</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500">Gastos</th>
                  <th className="px-4 py-2 text-right text-xs text-gray-500">Diferencia</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500">Estado</th>
                  <th className="px-4 py-2 text-center text-xs text-gray-500">Arqueo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historial.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono">{c.fecha}</td>
                    <td className="px-4 py-2 text-gray-600">{c.cajero || c.turno}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-700">${(c.total_ingresos || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-red-600">${(c.gastos_dia || 0).toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-bold ${(c.diferencia || 0) === 0 ? "text-green-600" : "text-red-600"}`}>
                      ${(c.diferencia || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.estado === "Cerrada" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => { setShowArqueo(c); setTimeout(() => guardarArqueoImagen(c), 300) }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        💾 PNG
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
