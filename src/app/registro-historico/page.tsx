"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

interface GastoForm {
  tipo: string
  descripcion: string
  monto: string
}

interface DiaRegistrado {
  fecha: string
  total_efectivo: number
  total_qr: number
  total_gastos: number
}

const TIPOS_GASTO = [
  "Ingredientes",
  "Personal",
  "Alquiler",
  "Servicios",
  "Gas",
  "Limpieza",
  "Mantenimiento",
  "Transporte",
  "Otro",
]

export default function RegistroHistoricoPage() {
  const [fecha, setFecha] = useState("")
  const [ventasEfectivo, setVentasEfectivo] = useState("")
  const [ventasQR, setVentasQR] = useState("")
  const [gastos, setGastos] = useState<GastoForm[]>([])
  const [diasRegistrados, setDiasRegistrados] = useState<DiaRegistrado[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error" | "warn"; texto: string } | null>(null)
  const [diaExistente, setDiaExistente] = useState(false)
  const [mesVista, setMesVista] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
  })

  const hoy = new Date().toISOString().split("T")[0]

  // Cargar dias registrados
  const cargarDias = useCallback(async () => {
    setLoading(true)
    const [anio, mes] = mesVista.split("-").map(Number)
    const desde = `${mesVista}-01`
    const hasta = `${anio}-${String(mes + 1).padStart(2, "0")}-01`

    // Obtener ventas históricas (las que tienen producto "Venta Histórica")
    const { data: ventas } = await supabase
      .from("ventas")
      .select("fecha, metodo_pago, total")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .eq("producto", "Venta Histórica")

    // Obtener gastos del mes
    const { data: gastosData } = await supabase
      .from("gastos")
      .select("fecha, monto")
      .gte("fecha", desde)
      .lt("fecha", hasta)

    // Agrupar por día
    const diasMap = new Map<string, DiaRegistrado>()

    ventas?.forEach((v) => {
      const dia = diasMap.get(v.fecha) || { fecha: v.fecha, total_efectivo: 0, total_qr: 0, total_gastos: 0 }
      if (v.metodo_pago === "efectivo") dia.total_efectivo += Number(v.total)
      if (v.metodo_pago === "qr") dia.total_qr += Number(v.total)
      diasMap.set(v.fecha, dia)
    })

    // Solo sumar gastos si el día ya tiene ventas históricas
    gastosData?.forEach((g) => {
      const dia = diasMap.get(g.fecha)
      if (dia) dia.total_gastos += Number(g.monto)
    })

    const dias = Array.from(diasMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
    setDiasRegistrados(dias)
    setLoading(false)
  }, [mesVista])

  useEffect(() => {
    cargarDias()
  }, [cargarDias])

  // Verificar si el día ya tiene datos
  useEffect(() => {
    if (!fecha) {
      setDiaExistente(false)
      return
    }
    const existe = diasRegistrados.some((d) => d.fecha === fecha)
    setDiaExistente(existe)
  }, [fecha, diasRegistrados])

  function agregarGasto() {
    setGastos([...gastos, { tipo: "Ingredientes", descripcion: "", monto: "" }])
  }

  function quitarGasto(index: number) {
    setGastos(gastos.filter((_, i) => i !== index))
  }

  function actualizarGasto(index: number, campo: keyof GastoForm, valor: string) {
    const nuevos = [...gastos]
    nuevos[index] = { ...nuevos[index], [campo]: valor }
    setGastos(nuevos)
  }

  async function guardar() {
    if (!fecha) {
      setMensaje({ tipo: "error", texto: "Selecciona una fecha" })
      return
    }

    const efectivo = parseFloat(ventasEfectivo) || 0
    const qr = parseFloat(ventasQR) || 0

    if (efectivo === 0 && qr === 0) {
      setMensaje({ tipo: "error", texto: "Ingresa al menos un monto de venta" })
      return
    }

    setGuardando(true)
    setMensaje(null)

    try {
      // Si ya existe, borrar registros históricos anteriores de ese día
      if (diaExistente) {
        await supabase.from("ventas").delete().eq("fecha", fecha).eq("producto", "Venta Histórica")
        await supabase.from("gastos").delete().eq("fecha", fecha).like("descripcion", "%(histórico)%")
      }

      // Insertar ventas
      const ventaRows = []
      const hora = "12:00:00"

      if (efectivo > 0) {
        ventaRows.push({
          order_id: `HIST-${fecha}`,
          producto_id: "historico",
          producto: "Venta Histórica",
          categoria: "Histórico",
          cantidad: 1,
          precio_unitario: efectivo,
          total: efectivo,
          metodo_pago: "efectivo",
          cajero: "Registro Histórico",
          estado: "completada",
          hora,
          fecha,
        })
      }

      if (qr > 0) {
        ventaRows.push({
          order_id: `HIST-${fecha}`,
          producto_id: "historico",
          producto: "Venta Histórica",
          categoria: "Histórico",
          cantidad: 1,
          precio_unitario: qr,
          total: qr,
          metodo_pago: "qr",
          cajero: "Registro Histórico",
          estado: "completada",
          hora,
          fecha,
        })
      }

      const { error: errorVentas } = await supabase.from("ventas").insert(ventaRows)
      if (errorVentas) throw errorVentas

      // Insertar gastos
      if (gastos.length > 0) {
        const [anio, mes] = fecha.split("-").map(Number)
        const gastosRows = gastos
          .filter((g) => parseFloat(g.monto) > 0)
          .map((g) => ({
            fecha,
            tipo: g.tipo,
            descripcion: `${g.descripcion || g.tipo} (histórico)`,
            monto: parseFloat(g.monto),
            mes,
            anio,
          }))

        if (gastosRows.length > 0) {
          const { error: errorGastos } = await supabase.from("gastos").insert(gastosRows)
          if (errorGastos) throw errorGastos
        }
      }

      // Insertar/actualizar caja_diaria
      const totalIngresos = efectivo + qr
      const totalGastos = gastos.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)

      const { data: cajaExiste } = await supabase
        .from("caja_diaria")
        .select("id")
        .eq("fecha", fecha)
        .limit(1)

      if (cajaExiste && cajaExiste.length > 0) {
        await supabase
          .from("caja_diaria")
          .update({
            ventas_efectivo: efectivo,
            ventas_qr: qr,
            ventas_pos_efectivo: efectivo,
            ventas_pos_qr: qr,
            total_ingresos: totalIngresos,
            gastos_dia: totalGastos,
            caja_final: totalIngresos - totalGastos,
          })
          .eq("id", cajaExiste[0].id)
      } else {
        await supabase.from("caja_diaria").insert({
          fecha,
          turno: "Completo",
          cajero: "Registro Histórico",
          hora_apertura: "08:00:00",
          hora_cierre: "22:00:00",
          caja_inicial: 0,
          ventas_efectivo: efectivo,
          ventas_qr: qr,
          ventas_tarjeta: 0,
          ventas_pos_efectivo: efectivo,
          ventas_pos_qr: qr,
          ventas_app_efectivo: 0,
          ventas_app_qr: 0,
          otros_ingresos: 0,
          total_ingresos: totalIngresos,
          gastos_dia: totalGastos,
          caja_final: totalIngresos - totalGastos,
          efectivo_contado: 0,
          diferencia: 0,
          estado: "Cerrada",
        })
      }

      setMensaje({
        tipo: "ok",
        texto: diaExistente
          ? `Datos del ${formatearFecha(fecha)} actualizados`
          : `${formatearFecha(fecha)} guardado correctamente`,
      })

      // Limpiar formulario
      setVentasEfectivo("")
      setVentasQR("")
      setGastos([])
      setFecha("")
      cargarDias()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido"
      setMensaje({ tipo: "error", texto: `Error al guardar: ${errorMsg}` })
    } finally {
      setGuardando(false)
    }
  }

  function formatearFecha(f: string) {
    const [a, m, d] = f.split("-")
    return `${d}/${m}/${a}`
  }

  function getNombreMes(mesStr: string) {
    const [a, m] = mesStr.split("-").map(Number)
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${meses[m - 1]} ${a}`
  }

  // Calcular días del mes para el calendario visual
  function getDiasDelMes() {
    const [anio, mes] = mesVista.split("-").map(Number)
    const diasEnMes = new Date(anio, mes, 0).getDate()
    const dias: string[] = []
    for (let d = 1; d <= diasEnMes; d++) {
      dias.push(`${mesVista}-${String(d).padStart(2, "0")}`)
    }
    return dias
  }

  const diasDelMes = getDiasDelMes()
  const registradosSet = new Set(diasRegistrados.map((d) => d.fecha))
  const totalMesEfectivo = diasRegistrados.reduce((s, d) => s + d.total_efectivo, 0)
  const totalMesQR = diasRegistrados.reduce((s, d) => s + d.total_qr, 0)
  const totalMesGastos = diasRegistrados.reduce((s, d) => s + d.total_gastos, 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Registro Historico de Ventas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registra las ventas de dias pasados desde tu cuaderno
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-lg">Registrar un dia</h2>

        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            max={hoy}
            className="border rounded-lg px-3 py-2 text-sm w-full md:w-64"
          />
          {diaExistente && (
            <p className="text-amber-600 text-xs mt-1">
              Ya hay datos para este dia. Al guardar se reemplazaran.
            </p>
          )}
        </div>

        {/* Ventas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Ventas Efectivo ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ventasEfectivo}
              onChange={(e) => setVentasEfectivo(e.target.value)}
              placeholder="0.00"
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Ventas QR ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ventasQR}
              onChange={(e) => setVentasQR(e.target.value)}
              placeholder="0.00"
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
        </div>

        {/* Total del día */}
        {(ventasEfectivo || ventasQR) && (
          <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
            <span className="text-gray-500">Total del dia: </span>
            <span className="font-bold text-gray-800">
              ${((parseFloat(ventasEfectivo) || 0) + (parseFloat(ventasQR) || 0)).toFixed(2)}
            </span>
          </div>
        )}

        {/* Gastos */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700 text-sm">Gastos del dia (opcional)</h3>
            <button
              onClick={agregarGasto}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              + Agregar gasto
            </button>
          </div>

          {gastos.length === 0 && (
            <p className="text-xs text-gray-400">No hay gastos agregados</p>
          )}

          {gastos.map((gasto, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
              <div className="col-span-3">
                {i === 0 && <label className="block text-xs text-gray-500 mb-1">Tipo</label>}
                <select
                  value={gasto.tipo}
                  onChange={(e) => actualizarGasto(i, "tipo", e.target.value)}
                  className="border rounded px-2 py-2 text-sm w-full"
                >
                  {TIPOS_GASTO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-5">
                {i === 0 && <label className="block text-xs text-gray-500 mb-1">Descripcion</label>}
                <input
                  type="text"
                  value={gasto.descripcion}
                  onChange={(e) => actualizarGasto(i, "descripcion", e.target.value)}
                  placeholder="Descripcion"
                  className="border rounded px-2 py-2 text-sm w-full"
                />
              </div>
              <div className="col-span-3">
                {i === 0 && <label className="block text-xs text-gray-500 mb-1">Monto</label>}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={gasto.monto}
                  onChange={(e) => actualizarGasto(i, "monto", e.target.value)}
                  placeholder="0.00"
                  className="border rounded px-2 py-2 text-sm w-full"
                />
              </div>
              <div className="col-span-1">
                <button
                  onClick={() => quitarGasto(i)}
                  className="text-red-400 hover:text-red-600 text-lg"
                  title="Quitar"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Mensaje */}
        {mensaje && (
          <div
            className={`rounded-lg px-4 py-2 text-sm ${
              mensaje.tipo === "ok"
                ? "bg-green-50 text-green-700 border border-green-200"
                : mensaje.tipo === "warn"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {/* Botón guardar */}
        <button
          onClick={guardar}
          disabled={guardando || !fecha}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {guardando ? "Guardando..." : diaExistente ? "Actualizar dia" : "Guardar dia"}
        </button>
      </div>

      {/* Calendario visual */}
      <div className="bg-white rounded-2xl border shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700 text-lg">Calendario de registros</h2>
          <input
            type="month"
            value={mesVista}
            onChange={(e) => setMesVista(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        <p className="text-sm text-gray-500 mb-3">{getNombreMes(mesVista)}</p>

        {loading ? (
          <p className="text-gray-400 text-sm">Cargando...</p>
        ) : (
          <>
            {/* Grid de días */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                  {d}
                </div>
              ))}
              {(() => {
                const [anio, mes] = mesVista.split("-").map(Number)
                const primerDia = new Date(anio, mes - 1, 1).getDay()
                const offset = primerDia === 0 ? 6 : primerDia - 1
                const celdas = []
                for (let i = 0; i < offset; i++) {
                  celdas.push(<div key={`empty-${i}`} />)
                }
                diasDelMes.forEach((diaFecha) => {
                  const diaNum = parseInt(diaFecha.split("-")[2])
                  const registrado = registradosSet.has(diaFecha)
                  const esFuturo = diaFecha > hoy
                  celdas.push(
                    <button
                      key={diaFecha}
                      onClick={() => !esFuturo && setFecha(diaFecha)}
                      disabled={esFuturo}
                      className={`text-center py-1.5 rounded text-sm transition-colors ${
                        fecha === diaFecha
                          ? "bg-red-600 text-white font-bold"
                          : registrado
                          ? "bg-green-100 text-green-700 font-medium hover:bg-green-200"
                          : esFuturo
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {diaNum}
                    </button>
                  )
                })
                return celdas
              })()}
            </div>

            {/* Leyenda */}
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Registrado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" /> Sin registro
              </span>
            </div>

            {/* Resumen del mes */}
            {diasRegistrados.length > 0 && (
              <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Efectivo</p>
                  <p className="text-lg font-bold text-green-700">${totalMesEfectivo.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">QR</p>
                  <p className="text-lg font-bold text-blue-700">${totalMesQR.toFixed(2)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Gastos</p>
                  <p className="text-lg font-bold text-red-700">${totalMesGastos.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Dias registrados</p>
                  <p className="text-lg font-bold text-gray-700">{diasRegistrados.length}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabla de días registrados */}
      {diasRegistrados.length > 0 && (
        <div className="bg-white rounded-2xl border shadow p-5">
          <h2 className="font-semibold text-gray-700 text-lg mb-3">
            Detalle {getNombreMes(mesVista)}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4 text-right">Efectivo</th>
                  <th className="py-2 pr-4 text-right">QR</th>
                  <th className="py-2 pr-4 text-right">Total Ventas</th>
                  <th className="py-2 pr-4 text-right">Gastos</th>
                  <th className="py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {diasRegistrados.map((dia) => {
                  const totalVentas = dia.total_efectivo + dia.total_qr
                  const neto = totalVentas - dia.total_gastos
                  return (
                    <tr key={dia.fecha} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-4">{formatearFecha(dia.fecha)}</td>
                      <td className="py-2 pr-4 text-right">${dia.total_efectivo.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right">${dia.total_qr.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right font-medium">${totalVentas.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right text-red-600">${dia.total_gastos.toFixed(2)}</td>
                      <td className={`py-2 text-right font-bold ${neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${neto.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4 text-right">${totalMesEfectivo.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right">${totalMesQR.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right">${(totalMesEfectivo + totalMesQR).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-red-600">${totalMesGastos.toFixed(2)}</td>
                  <td className={`py-2 text-right ${(totalMesEfectivo + totalMesQR - totalMesGastos) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${(totalMesEfectivo + totalMesQR - totalMesGastos).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
