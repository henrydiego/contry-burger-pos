"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

export default function ConfigPage() {
  const [qrUrl, setQrUrl] = useState("")
  const [instrucciones, setInstrucciones] = useState("Escanea el QR con tu app de Yape o BCP y envía el monto exacto.")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    const { data } = await supabase.from("configuracion").select("*").eq("id", 1).single()
    if (data) {
      setQrUrl(data.qr_pago_url || "")
      setInstrucciones(data.instrucciones_pago || instrucciones)
    }
  }

  async function uploadQR(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const fileName = `qr-pago.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("config")
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from("config").getPublicUrl(fileName)
      setQrUrl(data.publicUrl + "?t=" + Date.now())
      setMsg("Imagen subida. Guarda los cambios.")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al subir imagen"
      alert("Error: " + msg)
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true)
    setMsg("")
    const { error } = await supabase.from("configuracion").upsert({
      id: 1,
      qr_pago_url: qrUrl,
      instrucciones_pago: instrucciones,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setMsg(error ? "Error al guardar" : "Guardado correctamente")
    setTimeout(() => setMsg(""), 3000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">Configuración</h2>

      {/* QR de pago */}
      <div className="bg-white rounded-xl border shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold">QR de Pago (Yape / BCP)</h3>
        <p className="text-sm text-gray-500">
          Sube la imagen del QR de tu cuenta Yape o BCP. Los clientes la verán al pagar.
        </p>

        {/* Preview */}
        {qrUrl && (
          <div className="flex items-start gap-4">
            <img
              src={qrUrl}
              alt="QR de pago"
              className="w-40 h-40 object-contain border rounded-lg"
            />
            <div className="text-sm text-green-600 font-medium mt-2">QR cargado</div>
          </div>
        )}

        {/* Upload */}
        <div className="flex gap-3 items-center">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadQR(file)
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : "Subir imagen QR"}
          </button>
          <span className="text-xs text-gray-400">o pega la URL abajo</span>
        </div>

        {/* URL manual */}
        <div>
          <label className="text-sm text-gray-600 block mb-1">URL de imagen (alternativa)</label>
          <input
            type="url"
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Instrucciones */}
        <div>
          <label className="text-sm text-gray-600 block mb-1">Instrucciones para el cliente</label>
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
          {msg && (
            <span className={`text-sm font-medium ${msg.includes("Error") ? "text-red-500" : "text-green-600"}`}>
              {msg}
            </span>
          )}
        </div>
      </div>

      {/* Info Google Auth */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2">
        <h3 className="font-semibold text-blue-800">Login con Google (clientes)</h3>
        <p className="text-sm text-blue-700">
          Los clientes pueden entrar al menú con Google (opcional). Para activarlo:
        </p>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Ve a <strong>Supabase → Authentication → Providers → Google</strong></li>
          <li>Activa Google y copia el <strong>Callback URL</strong></li>
          <li>Crea un proyecto en <strong>console.cloud.google.com</strong></li>
          <li>Configura OAuth consent screen y crea credenciales Web</li>
          <li>Pega el <strong>Client ID</strong> y <strong>Client Secret</strong> en Supabase</li>
        </ol>
      </div>
    </div>
  )
}
