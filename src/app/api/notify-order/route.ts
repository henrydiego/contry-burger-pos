import { NextResponse } from 'next/server'

// Esta ruta ya no envía notificaciones automáticas.
// El cliente confirma su pago manualmente vía botón WhatsApp (wa.me/).
export async function POST() {
  return NextResponse.json({ ok: true })
}
