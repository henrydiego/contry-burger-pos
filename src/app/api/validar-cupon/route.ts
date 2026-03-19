import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rate limiting: max 3 intentos por IP cada 10 minutos
const intentos = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = intentos.get(ip)
  if (!entry || now > entry.reset) {
    intentos.set(ip, { count: 1, reset: now + 10 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos. Intenta de nuevo en 10 minutos.' },
      { status: 429 }
    )
  }

  try {
    const { codigo, total } = await req.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: cupon } = await supabase
      .from('cupones')
      .select('*')
      .eq('codigo', String(codigo).toUpperCase().trim())
      .eq('activo', true)
      .single()

    if (!cupon) return NextResponse.json({ ok: false, error: 'Cupón inválido o inactivo' })

    if (cupon.fecha_vencimiento && new Date(cupon.fecha_vencimiento) < new Date()) {
      return NextResponse.json({ ok: false, error: 'Cupón vencido' })
    }

    if (cupon.usos_actuales >= cupon.usos_max) {
      return NextResponse.json({ ok: false, error: 'Cupón agotado' })
    }

    const descuento =
      cupon.tipo === 'porcentaje'
        ? (Number(total) * Number(cupon.valor)) / 100
        : Number(cupon.valor)

    return NextResponse.json({
      ok: true,
      cupon: { id: cupon.id, codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor },
      descuento: Math.min(descuento, Number(total)),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok: false, error: 'Error al validar cupón' })
  }
}
