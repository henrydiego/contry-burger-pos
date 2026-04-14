"use client"

import { useRef, useCallback } from "react"

interface AlertaSonidoOptions {
  duracionSegundos?: number
  volumen?: number
  frecuenciaBase?: number
}

export function useAlertaSonido() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodesRef = useRef<GainNode[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const detener = useCallback(() => {
    // Limpiar intervalos y timeouts
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Detener todos los osciladores
    oscillatorsRef.current.forEach(osc => {
      try {
        osc.stop()
        osc.disconnect()
      } catch { /* ignorar si ya está detenido */ }
    })
    oscillatorsRef.current = []

    // Desconectar gains
    gainNodesRef.current.forEach(gain => {
      try {
        gain.disconnect()
      } catch { /* ignorar */ }
    })
    gainNodesRef.current = []

    // Cerrar contexto
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch { /* ignorar */ }
      audioContextRef.current = null
    }
  }, [])

  const reproducir = useCallback((options: AlertaSonidoOptions = {}) => {
    const {
      duracionSegundos = 15,
      volumen = 0.8,
      frecuenciaBase = 800
    } = options

    // Detener cualquier sonido anterior
    detener()

    try {
      const ctx = new AudioContext()
      audioContextRef.current = ctx

      // Crear sonido tipo "ringtone" de teléfono
      // Patrón: ring-ring-ring (dos tonos por ciclo, pausa, repite)
      const reproducirCiclo = () => {
        const now = ctx.currentTime

        // Primer tono del ring (más alto)
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = "sine"
        osc1.frequency.setValueAtTime(frecuenciaBase + 400, now)
        osc1.frequency.exponentialRampToValueAtTime(frecuenciaBase + 200, now + 0.15)
        gain1.gain.setValueAtTime(volumen, now)
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.4)
        oscillatorsRef.current.push(osc1)
        gainNodesRef.current.push(gain1)

        // Segundo tono del ring (más bajo)
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = "sine"
        osc2.frequency.setValueAtTime(frecuenciaBase + 200, now + 0.45)
        osc2.frequency.exponentialRampToValueAtTime(frecuenciaBase, now + 0.6)
        gain2.gain.setValueAtTime(volumen, now + 0.45)
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.9)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.45)
        osc2.stop(now + 0.9)
        oscillatorsRef.current.push(osc2)
        gainNodesRef.current.push(gain2)
      }

      // Reproducir inmediatamente
      reproducirCiclo()

      // Repetir cada 1.5 segundos (patrón ring-ring)
      intervalRef.current = setInterval(reproducirCiclo, 1500)

      // Auto-detener después de la duración
      timeoutRef.current = setTimeout(() => {
        detener()
      }, duracionSegundos * 1000)

      return true
    } catch (error) {
      console.error("Error al reproducir sonido:", error)
      return false
    }
  }, [detener])

  return { reproducir, detener }
}
