"use client"

import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import Sidebar from "./Sidebar"
import { supabase } from "@/lib/supabase"

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isPublicPage = pathname.startsWith("/menu") || pathname === "/login"

  // Cerrar sidebar al navegar
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Auto-refresh de sesión global — evita que se cierre en cualquier página
  useEffect(() => {
    if (isPublicPage) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login'
      }
    })

    const refreshInterval = setInterval(async () => {
      await supabase.auth.getSession()
    }, 10 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [isPublicPage])

  if (isPublicPage) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 shadow-2xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center gap-3 shrink-0 shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white hover:text-red-400 transition-colors p-1"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-bold text-red-500 text-lg">Contry Burger</h1>
        </header>

        <main className="flex-1 overflow-auto p-3 md:p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
