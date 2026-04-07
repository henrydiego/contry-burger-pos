"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import html2canvas from "html2canvas"
import { type Role } from "@/lib/roles"

// ── Denominaciones Bolivia/Perú ──────────────────────────────
const BILLETES = [200, 100, 50, 20, 10, 5, 2, 1]
const MONEDAS  = [5, 2, 1, 0.5, 0.2, 0.1]

interface Conteo { [k: string]: number }

interface CajaRec {
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

interface Gasto {
  id: number
  concepto: string
  monto: number
  fecha: string
  categoria: string
}

function conteoTotal(c: Conteo): number {
  return Object.entries(c).reduce((s, [k, v]) => s + parseFloat(k) * (v || 0), 0)
}

function initConteo(): Conteo {
  const c: Conteo = {}
  ;[...BILLETES, ...MONEDAS].forEach(d => { c[String(d)] = 0 })
  return c
}

export default function CajaPage() {
  const hoy = new Date().toISOString().split("T")[0]

  const [cajaHoy, setCajaHoy]           = useState<CajaRec | null>(null)
  const [historial, setHistorial]       = useState<CajaRec[]>([])
  const [gastosHoy, setGastosHoy]       = useState<Gasto[]>([])
  const [gastosArqueo, setGastosArqueo] = useState<Gasto[]>([])
  const [ventasPos, setVentasPos]       = useState({ efectivo: 0, qr: 0, tarjeta: 0 })
  const [ventasApp, setVentasApp]       = useState({ efectivo: 0, qr: 0 })
  const [loading, setLoading]           = useState(true)

  // Formularios
  const [showAbrirForm, setShowAbrirForm]   = useState(false)
  const [showCerrarForm, setShowCerrarForm] = useState(false)
  const [showGastoForm, setShowGastoForm]   = useState(false)
  const [showArqueoId, setShowArqueoId]     = useState<number | null>(null)

  const [formApertura, setFormApertura] = useState({ cajero: "", caja_inicial: "" })
  const [conteo, setConteo]             = useState<Conteo>(initConteo())
  const [otrosIngresos, setOtrosIngresos] = useState("")
  const [formGasto, setFormGasto]       = useState({ concepto: "", monto: "", comprobante: "", categoria: "Operacion" })
  const [guardando, setGuardando]       = useState(false)
  const [guardandoImg, setGuardandoImg] = useState(false)
  const [userRole, setUserRole]         = useState<Role | undefined>(undefined)

  useEffect(() => {
    loadTodo()
    supabase.auth.getUser().then(({ data }) => {
      setUserRole(data.user?.app_metadata?.role as Role | undefined)
    })
  }, [])

  async function loadTodo() {
    const [cajaRes, histRes, gastosRes, vPosRes, vAppRes] = await Promise.all([
      supabase.from("caja_diaria").select("*").eq("fecha", hoy).limit(1),
      supabase.from("caja_diaria").select("*").order("fecha", { ascending: false }).limit(60),
      supabase.from("gastos").select("*").eq("fecha", hoy),
      supabase.from("ventas").select("metodo_pago, total").eq("fecha", hoy),
      supabase.from("pedidos").select("metodo_pago, total").eq("fecha", hoy).eq("estado", "entregado"),
    ])
    setCajaHoy((cajaRes.data?.[0] || null) as CajaRec | null)
    setHistorial((histRes.data || []) as CajaRec[])
    setGastosHoy((gastosRes.data || []) as Gasto[])

    const vPos = (vPosRes.data || []).reduce(
      (a, v) => {
        const t = Number(v.total) || 0
        if (v.metodo_pago === "efectivo") a.efectivo += t
        else if (v.metodo_pago === "qr")  a.qr       += t
        else                              a.tarjeta  += t
        return a
      }, { efectivo: 0, qr: 0, tarjeta: 0 })
    setVentasPos(vPos)

    const vApp = (vAppRes.data || []).reduce(
      (a, p) => {
        const t = Number(p.total) || 0
        if (p.metodo_pago === "efectivo") a.efectivo += t
        else                              a.qr       += t
        return a
      }, { efectivo: 0, qr: 0 })
    setVentasApp(vApp)
    setLoading(false)
  }

  async function abrirCaja() {
    if (!formApertura.cajero.trim()) { alert("Ingresa el nombre del cajero"); return }
    setGuardando(true)
    const { data: existe } = await supabase.from("caja_diaria").select("id").eq("fecha", hoy).limit(1)
    if (existe && existe.length > 0) { setGuardando(false); setShowAbrirForm(false); loadTodo(); return }
    const hora = new Date().toTimeString().split(" ")[0]
    const { error } = await supabase.from("caja_diaria").insert({
      fecha: hoy, turno: "Completo", cajero: formApertura.cajero.trim(),
      hora_apertura: hora, caja_inicial: parseFloat(formApertura.caja_inicial) || 0,
      ventas_efectivo: 0, ventas_qr: 0, ventas_tarjeta: 0, otros_ingresos: 0,
      total_ingresos: 0, gastos_dia: 0,
      caja_final: parseFloat(formApertura.caja_inicial) || 0, diferencia: 0, estado: "Abierta",
    })
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setShowAbrirForm(false); setFormApertura({ cajero: "", caja_inicial: "" }); loadTodo()
  }

  async function cerrarCaja() {
    if (!cajaHoy) return
    setGuardando(true)
    const hora            = new Date().toTimeString().split(" ")[0]
    const totalPos        = ventasPos.efectivo + ventasPos.qr + ventasPos.tarjeta
    const totalApp        = ventasApp.efectivo + ventasApp.qr
    const otrosNum        = parseFloat(otrosIngresos) || 0
    const totalIngresos   = totalPos + totalApp + otrosNum
    const totalGastos     = gastosHoy.reduce((s, g) => s + g.monto, 0)
    const cajaFinal       = (cajaHoy.caja_inicial || 0) + totalIngresos - totalGastos
    const efectivoContado = conteoTotal(conteo)
    const efectivoSistema = (cajaHoy.caja_inicial || 0) + ventasPos.efectivo + ventasApp.efectivo - totalGastos
    const diferencia      = efectivoContado - efectivoSistema

    const { error } = await supabase.from("caja_diaria").update({
      hora_cierre: hora,
      ventas_pos_efectivo: ventasPos.efectivo, ventas_pos_qr: ventasPos.qr,
      ventas_app_efectivo: ventasApp.efectivo, ventas_app_qr: ventasApp.qr,
      ventas_efectivo: ventasPos.efectivo + ventasApp.efectivo,
      ventas_qr: ventasPos.qr + ventasApp.qr, ventas_tarjeta: ventasPos.tarjeta,
      otros_ingresos: otrosNum, total_ingresos: totalIngresos,
      gastos_dia: totalGastos, caja_final: cajaFinal,
      efectivo_contado: efectivoContado, diferencia, estado: "Cerrada",
    }).eq("id", cajaHoy.id)

    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setShowCerrarForm(false); setConteo(initConteo()); setOtrosIngresos(""); loadTodo()
  }

  async function reabrirCaja() {
    if (!cajaHoy || userRole !== 'admin') return
    if (!confirm("Reabrir la caja del dia? Esto permite seguir registrando ventas y gastos.")) return
    setGuardando(true)
    const { error } = await supabase.from("caja_diaria").update({
      estado: "Abierta",
      hora_cierre: null,
      efectivo_contado: null,
      diferencia: 0,
    }).eq("id", cajaHoy.id)
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    loadTodo()
  }

  async function agregarGasto() {
    if (!formGasto.concepto.trim() || !formGasto.monto) return
    setGuardando(true)
    const conceptoFull = formGasto.comprobante
      ? `[Comp. #${formGasto.comprobante}] ${formGasto.concepto.trim()}`
      : formGasto.concepto.trim()
    const { error } = await supabase.from("gastos").insert({
      concepto: conceptoFull, monto: parseFloat(formGasto.monto),
      fecha: hoy, categoria: formGasto.categoria,
    })
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setFormGasto({ concepto: "", monto: "", comprobante: "", categoria: "Operacion" })
    setShowGastoForm(false); loadTodo()
  }

  async function loadGastosParaArqueo(fecha: string) {
    const { data } = await supabase.from("gastos").select("*").eq("fecha", fecha)
    setGastosArqueo((data || []) as Gasto[])
  }

  async function abrirArqueo(caja: CajaRec) {
    await loadGastosParaArqueo(caja.fecha)
    setShowArqueoId(caja.id)
  }

  async function guardarArqueoImg() {
    setGuardandoImg(true)
    try {
      const el = document.getElementById("arqueo-print-area")
      if (!el) return
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 })
      const caja = historial.find(c => c.id === showArqueoId)
      const link = document.createElement("a")
      link.download = `arqueo-caja-${caja?.fecha ?? hoy}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (e) { console.error(e) }
    finally { setGuardandoImg(false) }
  }

  if (loading) return <div className="text-gray-400 text-center py-8">Cargando caja...</div>

  const totalPosHoy      = ventasPos.efectivo + ventasPos.qr + ventasPos.tarjeta
  const totalAppHoy      = ventasApp.efectivo + ventasApp.qr
  const totalIngresosHoy = totalPosHoy + totalAppHoy
  const totalGastosHoy   = gastosHoy.reduce((s, g) => s + g.monto, 0)
  const netoHoy          = totalIngresosHoy - totalGastosHoy
  const totalContado     = conteoTotal(conteo)
  const efectivoSistema  = cajaHoy
    ? (cajaHoy.caja_inicial || 0) + ventasPos.efectivo + ventasApp.efectivo - totalGastosHoy
    : 0
  const diferenciaConteo = totalContado - efectivoSistema

  // Resúmenes historial
  const porSemana: Record<string, { ventas: number; gastos: number; dias: number }> = {}
  const porMes:    Record<string, { ventas: number; gastos: number; dias: number }> = {}
  historial.forEach(c => {
    const d    = new Date(c.fecha + "T12:00:00")
    const sem  = `${d.getFullYear()}-S${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}-${d.getMonth()}`
    const mes  = c.fecha.slice(0, 7)
    const ing  = Number(c.total_ingresos) || 0
    const gas  = Number(c.gastos_dia) || 0
    if (!porSemana[sem]) porSemana[sem] = { ventas: 0, gastos: 0, dias: 0 }
    if (!porMes[mes])    porMes[mes]    = { ventas: 0, gastos: 0, dias: 0 }
    porSemana[sem].ventas += ing; porSemana[sem].gastos += gas; porSemana[sem].dias++
    porMes[mes].ventas    += ing; porMes[mes].gastos    += gas; porMes[mes].dias++
  })

  const cajaArqueo = historial.find(c => c.id === showArqueoId) || null

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #arqueo-print-area, #arqueo-print-area * { visibility: visible !important; }
          #arqueo-print-area {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 88mm !important; padding: 5mm !important; font-size: 10px !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Caja Diaria</h2>
          <p className="text-sm text-gray-500">{hoy}</p>
        </div>
        {cajaHoy?.estado === "Abierta" && (
          <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping inline-block" />
            Caja Abierta — {cajaHoy.cajero || cajaHoy.turno}
          </span>
        )}
        {cajaHoy?.estado === "Cerrada" && (
          <span className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full text-sm">
            🔴 Caja Cerrada
          </span>
        )}
      </div>

      {/* ── SIN CAJA HOY ── */}
      {!cajaHoy && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center space-y-4">
          <p className="text-5xl">🏧</p>
          <p className="text-xl font-bold text-gray-700">La caja no ha sido abierta hoy</p>
          <p className="text-sm text-gray-500">Registra el monto inicial en efectivo (caja chica) para comenzar el dia</p>
          <button onClick={() => setShowAbrirForm(true)}
            className="bg-green-600 text-white px-10 py-3 rounded-xl font-bold text-lg hover:bg-green-700">
            Abrir Caja del Dia
          </button>
        </div>
      )}

      {/* ── CAJA ABIERTA ── */}
      {cajaHoy?.estado === "Abierta" && (
        <div className="space-y-4">

          {/* Ventas en vivo */}
          <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Ventas del Dia — En Vivo</h3>
              <span className="text-xs text-gray-400">Apertura: {cajaHoy.hora_apertura}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-black text-blue-700 uppercase tracking-wide">VENTAS DE CAJA</p>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Efectivo</span><span className="font-bold">${ventasPos.efectivo.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">QR / Digital</span><span className="font-bold">${ventasPos.qr.toFixed(2)}</span></div>
                {ventasPos.tarjeta > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Tarjeta</span><span className="font-bold">${ventasPos.tarjeta.toFixed(2)}</span></div>}
                <div className="flex justify-between font-black text-blue-700 border-t border-blue-200 pt-1 text-sm"><span>Subtotal</span><span>${totalPosHoy.toFixed(2)}</span></div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-black text-purple-700 uppercase tracking-wide">VENTAS EN LÍNEA</p>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Efectivo</span><span className="font-bold">${ventasApp.efectivo.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">QR / Digital</span><span className="font-bold">${ventasApp.qr.toFixed(2)}</span></div>
                <div className="flex justify-between font-black text-purple-700 border-t border-purple-200 pt-1 text-sm"><span>Subtotal</span><span>${totalAppHoy.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="bg-gray-900 text-white rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xs text-gray-400">Total Ingresos</p><p className="text-xl font-black text-green-400">${totalIngresosHoy.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400">Gastos</p><p className="text-xl font-black text-red-400">${totalGastosHoy.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400">Neto del Dia</p><p className={`text-xl font-black ${netoHoy >= 0 ? "text-white" : "text-red-400"}`}>${netoHoy.toFixed(2)}</p></div>
            </div>
          </div>

          {/* Gastos */}
          <div className="bg-white rounded-2xl border shadow p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Gastos / Egresos ({gastosHoy.length})</h3>
              <button onClick={() => setShowGastoForm(!showGastoForm)}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-700">
                + Registrar Gasto
              </button>
            </div>

            {showGastoForm && (
              <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Concepto</label>
                    <input type="text" placeholder="ej: Pago Coca-Cola" value={formGasto.concepto}
                      onChange={e => setFormGasto(f => ({ ...f, concepto: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Monto ($)</label>
                    <input type="number" step="0.01" placeholder="0.00" value={formGasto.monto}
                      onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">N° Comprobante</label>
                    <input type="text" placeholder="ej: 100, Fact-023" value={formGasto.comprobante}
                      onChange={e => setFormGasto(f => ({ ...f, comprobante: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Categoria</label>
                    <select value={formGasto.categoria} onChange={e => setFormGasto(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                      <option>Operacion</option>
                      <option>Proveedor</option>
                      <option>Personal</option>
                      <option>Servicios</option>
                      <option>Alquiler</option>
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

            {gastosHoy.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">Sin gastos registrados hoy</p>
              : (
                <div className="divide-y">
                  {gastosHoy.map(g => (
                    <div key={g.id} className="flex justify-between items-center py-2 text-sm">
                      <div>
                        <p className="font-medium">{g.concepto}</p>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{g.categoria}</span>
                      </div>
                      <span className="font-bold text-red-600">${g.monto.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-black pt-2 text-sm">
                    <span>Total Gastos</span>
                    <span className="text-red-600">${totalGastosHoy.toFixed(2)}</span>
                  </div>
                </div>
              )}
          </div>

          {/* Cierre con arqueo de denominaciones — admin y cajero */}
          {(
          <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Cierre de Caja — Arqueo</h3>
              <button onClick={() => setShowCerrarForm(!showCerrarForm)}
                className={`px-4 py-2 rounded-xl font-bold text-sm ${showCerrarForm ? "bg-gray-200 text-gray-600" : "bg-gray-800 text-white hover:bg-gray-900"}`}>
                {showCerrarForm ? "Cancelar" : "Cerrar Caja del Dia"}
              </button>
            </div>

            {showCerrarForm && (
              <div className="space-y-4">
                {/* Info sistema */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-bold text-blue-700">Efectivo en sistema (lo que deberia haber en caja):</p>
                  <p className="text-gray-700">
                    Inicial ${(cajaHoy.caja_inicial || 0).toFixed(2)} +
                    POS efectivo ${ventasPos.efectivo.toFixed(2)} +
                    App efectivo ${ventasApp.efectivo.toFixed(2)} -
                    Gastos ${totalGastosHoy.toFixed(2)} =
                    <strong className="text-blue-800"> ${efectivoSistema.toFixed(2)}</strong>
                  </p>
                </div>

                {/* Otros ingresos */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Otros ingresos no registrados ($)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={otrosIngresos}
                    onChange={e => setOtrosIngresos(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>

                {/* Conteo de denominaciones */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-800 text-white px-4 py-2 text-sm font-bold">
                    Conteo de Efectivo Fisico
                  </div>

                  {/* Billetes */}
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Billetes</p>
                    {BILLETES.map(d => (
                      <div key={d} className="flex items-center gap-3">
                        <span className="w-16 text-right text-sm font-bold text-gray-700">${d}.00</span>
                        <span className="text-gray-400 text-sm">×</span>
                        <input
                          type="number" min="0" placeholder="0"
                          value={conteo[String(d)] || ""}
                          onChange={e => setConteo(c => ({ ...c, [String(d)]: parseInt(e.target.value) || 0 }))}
                          className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-bold"
                        />
                        <span className="text-gray-400 text-sm">=</span>
                        <span className="font-semibold text-sm text-green-700 w-20">
                          ${((conteo[String(d)] || 0) * d).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {/* Monedas */}
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider pt-2">Monedas</p>
                    {MONEDAS.map(d => (
                      <div key={d} className="flex items-center gap-3">
                        <span className="w-16 text-right text-sm font-bold text-gray-700">${d.toFixed(2)}</span>
                        <span className="text-gray-400 text-sm">×</span>
                        <input
                          type="number" min="0" placeholder="0"
                          value={conteo[String(d)] || ""}
                          onChange={e => setConteo(c => ({ ...c, [String(d)]: parseInt(e.target.value) || 0 }))}
                          className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-bold"
                        />
                        <span className="text-gray-400 text-sm">=</span>
                        <span className="font-semibold text-sm text-green-700 w-20">
                          ${((conteo[String(d)] || 0) * d).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total contado */}
                  <div className="bg-gray-50 border-t px-4 py-3 flex justify-between items-center">
                    <span className="font-black text-gray-700">TOTAL CONTADO</span>
                    <span className="text-2xl font-black text-gray-900">${totalContado.toFixed(2)}</span>
                  </div>
                </div>

                {/* Diferencia */}
                {totalContado > 0 && (
                  <div className={`rounded-xl p-4 text-center space-y-1 ${Math.abs(diferenciaConteo) < 0.01 ? "bg-green-100" : "bg-red-100"}`}>
                    <p className="text-sm text-gray-600">Sistema: <strong>${efectivoSistema.toFixed(2)}</strong> | Contado: <strong>${totalContado.toFixed(2)}</strong></p>
                    <p className={`text-xl font-black ${Math.abs(diferenciaConteo) < 0.01 ? "text-green-700" : "text-red-700"}`}>
                      {Math.abs(diferenciaConteo) < 0.01
                        ? "✅ La caja CUADRA perfectamente"
                        : `${diferenciaConteo > 0 ? "⬆️ SOBRANTE" : "⬇️ FALTANTE"}: $${Math.abs(diferenciaConteo).toFixed(2)}`}
                    </p>
                  </div>
                )}

                <button onClick={cerrarCaja} disabled={guardando}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-black hover:bg-black disabled:opacity-50">
                  {guardando ? "Cerrando caja..." : "Confirmar Cierre y Generar Arqueo"}
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* ── CAJA CERRADA HOY ── */}
      {cajaHoy?.estado === "Cerrada" && (
        <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-gray-800">Caja cerrada correctamente</h3>
              <p className="text-xs text-gray-500">
                Apertura: {cajaHoy.hora_apertura || "—"} | Cierre: {cajaHoy.hora_cierre || "—"} | {cajaHoy.cajero || cajaHoy.turno}
              </p>
            </div>
            <div className="flex gap-2">
              {userRole === 'admin' && (
                <button onClick={reabrirCaja} disabled={guardando}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {guardando ? "..." : "Reabrir Caja"}
                </button>
              )}
              <button onClick={() => abrirArqueo(cajaHoy)}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700">
                Ver Arqueo
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
            <div className={`rounded-xl p-3 ${Math.abs(cajaHoy.diferencia || 0) < 0.01 ? "bg-gray-900" : "bg-red-700"}`}>
              <p className="text-xs text-gray-400">Diferencia</p>
              <p className="text-xl font-black text-white">${(cajaHoy.diferencia || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className={`text-center font-bold py-2 rounded-xl text-sm ${Math.abs(cajaHoy.diferencia || 0) < 0.01 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {Math.abs(cajaHoy.diferencia || 0) < 0.01 ? "✅ Caja Cuadra" : `⚠️ Descuadre de $${Math.abs(cajaHoy.diferencia || 0).toFixed(2)}`}
          </div>
        </div>
      )}

      {/* ── MODAL ARQUEO PROFESIONAL ── */}
      {showArqueoId !== null && cajaArqueo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Botones */}
            <div className="bg-gray-800 text-white p-4 flex items-center justify-between sticky top-0 rounded-t-2xl">
              <div>
                <p className="font-bold">Arqueo de Caja — {cajaArqueo.fecha}</p>
                <p className="text-gray-400 text-xs">{cajaArqueo.cajero || cajaArqueo.turno}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-white text-gray-800 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100">
                  🖨️ Imprimir
                </button>
                <button onClick={guardarArqueoImg} disabled={guardandoImg}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-60">
                  {guardandoImg ? "..." : "💾 PNG"}
                </button>
                <button onClick={() => setShowArqueoId(null)} className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-500">✕</button>
              </div>
            </div>

            {/* Contenido imprimible */}
            <div id="arqueo-print-area" className="p-6 font-mono text-xs bg-white">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-800 pb-3 mb-3">
                <p className="text-lg font-black tracking-widest">CONTRY BURGER</p>
                <p className="text-xs tracking-wider">ARQUEO DE CAJA DIARIA</p>
                <div className="mt-2 text-xs space-y-0.5">
                  <p>Fecha: <strong>{cajaArqueo.fecha}</strong></p>
                  <p>Cajero: <strong>{cajaArqueo.cajero || cajaArqueo.turno}</strong></p>
                  <p>Apertura: <strong>{cajaArqueo.hora_apertura || "—"}</strong> | Cierre: <strong>{cajaArqueo.hora_cierre || "—"}</strong></p>
                </div>
              </div>

              {/* Ingresos */}
              <div className="mb-3">
                <p className="font-black border-b border-gray-400 pb-1 mb-1">INGRESOS</p>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>Caja inicial</span><span>${(cajaArqueo.caja_inicial || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ventas POS efectivo</span><span>${(cajaArqueo.ventas_pos_efectivo || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ventas POS QR</span><span>${(cajaArqueo.ventas_pos_qr || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ventas App efectivo</span><span>${(cajaArqueo.ventas_app_efectivo || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Ventas App QR</span><span>${(cajaArqueo.ventas_app_qr || 0).toFixed(2)}</span></div>
                  {(cajaArqueo.otros_ingresos || 0) > 0 && (
                    <div className="flex justify-between"><span>Otros ingresos</span><span>${(cajaArqueo.otros_ingresos || 0).toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between font-black border-t border-gray-400 pt-1 mt-1">
                    <span>TOTAL INGRESOS</span><span>${(cajaArqueo.total_ingresos || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Gastos */}
              {gastosArqueo.length > 0 && (
                <div className="mb-3">
                  <p className="font-black border-b border-gray-400 pb-1 mb-1">GASTOS / EGRESOS</p>
                  <div className="space-y-0.5">
                    {gastosArqueo.map(g => (
                      <div key={g.id} className="flex justify-between">
                        <span className="flex-1 truncate pr-2">{g.concepto}</span>
                        <span>-${g.monto.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-black border-t border-gray-400 pt-1 mt-1">
                      <span>TOTAL GASTOS</span><span>-${(cajaArqueo.gastos_dia || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Caja final sistema */}
              <div className="border-y-2 border-gray-800 py-2 my-3">
                <div className="flex justify-between font-black text-sm">
                  <span>CAJA FINAL (SISTEMA)</span><span>${(cajaArqueo.caja_final || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Conteo fisico */}
              <div className="mb-3">
                <p className="font-black border-b border-gray-400 pb-1 mb-1">CONTEO FISICO DE EFECTIVO</p>
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">BILLETES</p>
                    {BILLETES.map(d => (
                      <div key={d} className="flex justify-between text-xs py-0.5">
                        <span>Bs {d}.00</span>
                        <span>× ____</span>
                        <span>= ________</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">MONEDAS</p>
                    {MONEDAS.map(d => (
                      <div key={d} className="flex justify-between text-xs py-0.5">
                        <span>Bs {d.toFixed(2)}</span>
                        <span>× ____</span>
                        <span>= ________</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between font-black border-t border-gray-800 pt-1 mt-2">
                  <span>TOTAL CONTADO</span>
                  <span>${(cajaArqueo.efectivo_contado || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Diferencia */}
              <div className={`text-center py-2 border-2 rounded mb-4 ${Math.abs(cajaArqueo.diferencia || 0) < 0.01 ? "border-gray-800" : "border-red-600"}`}>
                <p className="text-xs">Diferencia (Contado - Sistema)</p>
                <p className="font-black text-sm">
                  {Math.abs(cajaArqueo.diferencia || 0) < 0.01
                    ? "✅ CAJA CUADRA — $0.00"
                    : `${(cajaArqueo.diferencia || 0) > 0 ? "⬆️ SOBRANTE" : "⬇️ FALTANTE"}: $${Math.abs(cajaArqueo.diferencia || 0).toFixed(2)}`}
                </p>
              </div>

              {/* Firmas */}
              <div className="grid grid-cols-2 gap-6 mt-4 pt-3 border-t border-dashed border-gray-400 text-center text-xs">
                <div>
                  <div className="border-b border-gray-800 mb-1 h-8" />
                  <p>Firma Cajero</p>
                  <p className="text-gray-500">{cajaArqueo.cajero || "_______________"}</p>
                </div>
                <div>
                  <div className="border-b border-gray-800 mb-1 h-8" />
                  <p>Firma Supervisor</p>
                  <p className="text-gray-500">_______________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESÚMENES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resumen mensual */}
        <div className="bg-white rounded-2xl border shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-800">Resumen por Mes</h3>
          </div>
          <div className="divide-y">
            {Object.entries(porMes).slice(0, 6).map(([mes, d]) => (
              <div key={mes} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-mono text-gray-600">{mes}</span>
                <div className="flex gap-4 text-right">
                  <div><p className="text-xs text-gray-400">Ventas</p><p className="font-bold text-green-700">${d.ventas.toFixed(2)}</p></div>
                  <div><p className="text-xs text-gray-400">Gastos</p><p className="font-bold text-red-600">${d.gastos.toFixed(2)}</p></div>
                  <div><p className="text-xs text-gray-400">Neto</p><p className={`font-black ${(d.ventas - d.gastos) >= 0 ? "text-gray-800" : "text-red-600"}`}>${(d.ventas - d.gastos).toFixed(2)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historial diario */}
        <div className="bg-white rounded-2xl border shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-800">Historial Diario</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Fecha</th>
                  <th className="px-3 py-2 text-right text-gray-500">Ingresos</th>
                  <th className="px-3 py-2 text-right text-gray-500">Gastos</th>
                  <th className="px-3 py-2 text-center text-gray-500">Estado</th>
                  <th className="px-3 py-2 text-center text-gray-500">Arqueo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historial.slice(0, 15).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{c.fecha}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">${(c.total_ingresos || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-red-600">${(c.gastos_dia || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.estado === "Cerrada" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => abrirArqueo(c)} className="text-blue-600 hover:underline text-xs">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Abrir Caja */}
      {showAbrirForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-xl font-black text-gray-800">Abrir Caja</h3>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre del cajero / responsable</label>
              <input type="text" placeholder="ej: Juan Perez" value={formApertura.cajero}
                onChange={e => setFormApertura(f => ({ ...f, cajero: e.target.value }))}
                className="w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-green-500" autoFocus />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monto inicial en caja (efectivo fisico en caja)</label>
              <input type="number" step="0.01" placeholder="0.00" value={formApertura.caja_inicial}
                onChange={e => setFormApertura(f => ({ ...f, caja_inicial: e.target.value }))}
                className="w-full border-2 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-green-500" />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
              <p>Hora de apertura: <strong>{new Date().toLocaleTimeString("es-MX")}</strong></p>
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
    </div>
  )
}
