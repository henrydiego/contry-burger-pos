"use client"

import { useState, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import { getHomePage } from "@/lib/roles"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError("Email o contraseña incorrectos")
      setLoading(false)
      return
    }

    const role = data.user?.app_metadata?.role
    router.push(getHomePage(role))
    router.refresh()
  }

  async function loginConGoogle() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next === "/" ? "/menu" : next)}`,
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-red-500">Contry Burger</h1>
          <p className="text-gray-400 text-sm mt-1">Bienvenido</p>
        </div>

        {/* Clientes - Google */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 mb-4">
          <h2 className="text-white text-base font-bold mb-1">Clientes</h2>
          <p className="text-gray-400 text-xs mb-4">Inicia sesión para hacer tu pedido</p>
          <button
            onClick={loginConGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-100 disabled:opacity-60 transition-colors"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.8 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"/>
              <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.9 13.4-5l-6.2-5.3C29.3 37 26.8 38 24 38c-5.2 0-9.6-3.2-11.3-7.8l-6.5 5C9.6 41 16.3 45.5 24 45.5z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.4l6.2 5.3c3.6-3.3 5.8-8.3 5.8-14.2 0-1.4-.1-2.7-.4-4z"/>
            </svg>
            {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
          </button>
        </div>

        {/* Admin - Email/Password */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6">
          <h2 className="text-white text-base font-bold mb-1">Administración</h2>
          <p className="text-gray-400 text-xs mb-4">Solo personal autorizado</p>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900" />}>
      <LoginForm />
    </Suspense>
  )
}
