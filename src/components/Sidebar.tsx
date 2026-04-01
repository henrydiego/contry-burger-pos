"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { canAccessRoute } from "@/lib/roles"

const menuItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/pos", label: "Punto de Venta", icon: "🍔" },
  { href: "/pedidos", label: "Pedidos Online", icon: "📱" },
  { href: "/productos", label: "Productos", icon: "📦" },
  { href: "/ventas", label: "Ventas", icon: "💰" },
  { href: "/inventario", label: "Inventario", icon: "📋" },
  { href: "/compras", label: "Compras", icon: "🛒" },
  { href: "/recetas", label: "Recetas/Costos", icon: "📝" },
  { href: "/gastos", label: "Gastos", icon: "💸" },
  { href: "/reportes", label: "Reportes", icon: "📈" },
  { href: "/caja", label: "Caja Diaria", icon: "🏦" },
  { href: "/margenes", label: "Margenes", icon: "📐" },
  { href: "/estado-resultados", label: "Est. Resultados", icon: "🧾" },
  { href: "/horas-pico", label: "Horas Pico", icon: "🕐" },
  { href: "/merma", label: "Merma", icon: "⚠️" },
  { href: "/config", label: "Configuración", icon: "⚙️" },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setRole(data.user?.app_metadata?.role)
    })
  }, [])

  const visibleItems = menuItems.filter(item => canAccessRoute(role, item.href))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-red-500">🍔 Contry Burger</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {role === 'cajero' ? 'Caja' : 'Sistema POS / ERP'}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white p-1"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-red-600 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-700 space-y-2 shrink-0">
        <p className="text-xs text-gray-500">v2.0 — Contry Burger</p>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
