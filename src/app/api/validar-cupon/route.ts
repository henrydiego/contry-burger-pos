import { NextRequest, NextResponse } from 'next/server'
import { createBrowserClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  try {
    const { codigo, total } = await req.json()

    const supabase = createBrowserClient(
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
