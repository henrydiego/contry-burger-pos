"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/pos", label: "Punto de Venta", icon: "🍔" },
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
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-[var(--primary)]">🍔 Contry Burger</h1>
        <p className="text-xs text-gray-400 mt-1">Sistema POS / ERP</p>
      </div>
      <nav className="flex-1 py-2 overflow-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--primary)] text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        v2.0 — Contry Burger
      </div>
    </aside>
  )
}
