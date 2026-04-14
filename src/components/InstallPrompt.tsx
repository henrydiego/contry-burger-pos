"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // Guardar el evento de instalación
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Mostrar el prompt después de 3 segundos
      setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Detectar si se instaló
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      console.log("Usuario instaló la app")
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Guardar en localStorage para no mostrar por 24 horas
    localStorage.setItem("installPromptDismissed", Date.now().toString())
  }

  // Verificar si fue descartado recientemente
  useEffect(() => {
    const dismissed = localStorage.getItem("installPromptDismissed")
    if (dismissed) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60)
      if (hoursSinceDismissed < 24) {
        setShowPrompt(false)
      }
    }
  }, [])

  if (isInstalled || !showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-xl shadow-2xl p-4 border-2 border-orange-500 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🍔</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">¡Instala Contry Burger!</h3>
          <p className="text-sm text-gray-600 mt-1">
            Agrega esta app a tu pantalla de inicio para hacer pedidos más rápido.
            Sin necesidad de escribir la dirección.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-orange-600 transition-colors"
            >
              📲 Instalar App
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
