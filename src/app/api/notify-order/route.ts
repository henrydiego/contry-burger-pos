import { NextRequest, NextResponse } from 'next/server'
import { createBrowserClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { order_id, cliente_nombre, total, metodo_pago, items, latitud, longitud, direccion } = body

    // Leer config de Supabase
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: config } = await supabase
      .from('configuracion')
      .select('whatsapp_phone, whatsapp_apikey')
      .eq('id', 1)
      .single()

    const phone = config?.whatsapp_phone
    const apikey = config?.whatsapp_apikey

    if (!phone || !apikey) {
      return NextResponse.json({ ok: false, error: 'WhatsApp no configurado' })
    }

    const itemsText = (items as { cantidad: number; nombre: string }[])
      .map((i) => `${i.cantidad}x ${i.nombre}`)
      .join(', ')

    const lines = [
      `🍔 *NUEVO PEDIDO ${order_id}*`,
      `👤 ${cliente_nombre}`,
      `💰 $${Number(total).toFixed(2)} (${metodo_pago})`,
      `📋 ${itemsText}`,
    ]
    if (latitud) lines.push(`📍 maps.google.com/?q=${latitud},${longitud}`)
    if (direccion) lines.push(`🏠 ${direccion}`)

    const text = encodeURIComponent(lines.join('\n'))
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apikey}`

    await fetch(url)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('WhatsApp notify error:', err)
    return NextResponse.json({ ok: false })
  }
}
