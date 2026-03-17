"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface PedidoItem {
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  producto_id: string
}

interface Pedido {
  id: number
  order_id: string
  fecha: string
  hora: string
  total: number
  estado: string
  metodo_pago: string
  items: PedidoItem[]
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  preparando: "bg-blue-100 text-blue-700",
  listo: "bg-green-100 text-green-700",
  entregado: "bg-gray-100 text-gray-600",
  cancelado: "bg-red-100 text-red-700",
}

function MisPedidosContent() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [sinLogin, setSinLogin] = useState(false)

  useEffect(() => {
    loadPedidos()
  }, [])

  async function loadPedidos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSinLogin(true); setLoading(false); return }

    const { data } = await supabase
      .from("pedidos")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(50)

    setPedidos((data as Pedido[]) || [])
    setLoading(false)
  }

  function repetirPedido(pedido: Pedido) {
    const items = pedido.items.map((item) => ({
      producto_id: item.producto_id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal,
    }))
    sessionStorage.setItem("repeat_order", JSON.stringify(items))
    router.push("/menu")
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Cargando...</p></div>

  if (sinLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-5xl mb-4">🔐</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Inicia sesión para ver tus pedidos</h2>
        <p className="text-gray-500 text-sm mb-6">Usa tu cuenta de Google para acceder a tu historial</p>
        <a href="/menu" className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700">
          Volver al menú
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white sticky top-0 z-40 shadow">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-red-500">Contry Burger</h1>
            <p className="text-xs text-gray-400">Mis Pedidos</p>
          </div>
          <a href="/menu" className="text-sm text-gray-400 hover:text-white">← Menú</a>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {pedidos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📋</p>
            <p className="font-medium">Aún no tienes pedidos</p>
            <a href="/menu" className="mt-4 inline-block bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 text-sm">
              Hacer mi primer pedido
            </a>
          </div>
        ) : (
          pedidos.map((pedido) => (
            <div key={pedido.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{pedido.order_id}</p>
                  <p className="text-xs text-gray-400">{pedido.fecha} · {pedido.hora}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${ESTADO_COLOR[pedido.estado] || "bg-gray-100 text-gray-600"}`}>
                  {pedido.estado}
                </span>
              </div>

              <div className="p-3 space-y-1">
                {(pedido.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-600">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-base pt-1.5 border-t mt-1">
                  <span>Total</span>
                  <span className="text-red-600">${Number(pedido.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="px-3 pb-3 flex gap-2">
                {(pedido.estado === "pendiente" || pedido.estado === "preparando" || pedido.estado === "listo") && (
                  <a
                    href={`/menu/seguimiento?order=${pedido.order_id}`}
                    className="flex-1 text-center bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
                  >
                    Ver seguimiento
                  </a>
                )}
                {(pedido.estado === "entregado" || pedido.estado === "cancelado") && (
                  <button
                    onClick={() => repetirPedido(pedido)}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
                  >
                    🔄 Repetir pedido
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function MisPedidosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Cargando...</p></div>}>
      <MisPedidosContent />
    </Suspense>
  )
}
