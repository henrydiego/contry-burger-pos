import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Usa service role si está disponible, anon key como fallback
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, serviceKey)
}

export async function POST(req: NextRequest) {
  try {
    // Obtener usuario si tiene sesión (invitados permitidos, no requerido)
    let user = null
    try {
      const cookieStore = cookies()
      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
      )
      const { data: { user: u } } = await supabaseAuth.auth.getUser()
      user = u
    } catch { /* continuar como invitado */ }

    const body = await req.json()
    const {
      items, cliente_nombre, cliente_telefono, notas, metodo_pago,
      latitud, longitud, direccion, cupon_codigo,
      tipo_entrega, numero_mesa,
    } = body

    if (!items || !Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 })
    if (!cliente_nombre?.trim() || !cliente_telefono?.trim())
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos.' }, { status: 400 })

    const supabase = getServiceClient()

    const productoIds = items.map((i: { producto_id: string }) => i.producto_id)
    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, activo, agotado')
      .in('id', productoIds)

    if (prodError) throw new Error(`Error fetching products: ${prodError.message}`)
    if (!productos) return NextResponse.json({ error: 'No se encontraron los productos.' }, { status: 404 })

    let subtotal = 0
    const itemsVerificados: { producto_id: string; nombre: string; cantidad: number; precio_unitario: number; subtotal: number }[] = []

    for (const item of items) {
      const producto = productos.find(p => p.id === item.producto_id)
      if (!producto) return NextResponse.json({ error: `Producto no encontrado: ${item.producto_id}` }, { status: 400 })
      if (!producto.activo) return NextResponse.json({ error: `Producto no disponible: ${producto.nombre}` }, { status: 400 })
      if (producto.agotado) return NextResponse.json({ error: `Producto agotado: ${producto.nombre}` }, { status: 400 })
      const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1))
      const precio = Number(producto.precio_venta)
      const itemSubtotal = precio * cantidad
      subtotal += itemSubtotal
      itemsVerificados.push({ producto_id: producto.id, nombre: producto.nombre, cantidad, precio_unitario: precio, subtotal: itemSubtotal })
    }

    const { data: cfg } = await supabase.from('configuracion').select('costo_envio, pedido_minimo').eq('id', 1).maybeSingle()
    const esDelivery = tipo_entrega === 'delivery'
    const costoEnvio = (esDelivery && latitud) ? Number(cfg?.costo_envio ?? 0) : 0
    const pedidoMinimo = Number(cfg?.pedido_minimo ?? 0)

    if (pedidoMinimo > 0 && subtotal < pedidoMinimo)
      return NextResponse.json({ error: `El pedido mínimo es $${pedidoMinimo.toFixed(2)}` }, { status: 400 })

    let descuento = 0
    let cuponValido: string | null = null
    if (cupon_codigo) {
      const { data: cupon } = await supabase.from('cupones').select('*').eq('codigo', String(cupon_codigo).toUpperCase().trim()).eq('activo', true).single()
      if (cupon) {
        const noVencido = !cupon.fecha_vencimiento || new Date(cupon.fecha_vencimiento) >= new Date()
        const hayUsos = cupon.usos_actuales < cupon.usos_max
        if (noVencido && hayUsos) {
          descuento = cupon.tipo === 'porcentaje' ? (subtotal * Number(cupon.valor)) / 100 : Number(cupon.valor)
          descuento = Math.min(descuento, subtotal)
          cuponValido = cupon.codigo
        }
      }
    }

    const total = subtotal + costoEnvio - descuento

    const hora = new Date().toTimeString().split(' ')[0]
    const hoy = new Date().toISOString().split('T')[0]

    // Construir descripción de entrega
    let direccionFinal: string | null = null
    if (tipo_entrega === 'mesa') direccionFinal = `Mesa #${numero_mesa || '?'}`
    else if (tipo_entrega === 'local') direccionFinal = 'Recoger en local'
    else direccionFinal = direccion?.trim() || null

    // Notas combinadas (fallback si faltan columnas extendidas)
    const notasBase = [notas?.trim(), direccionFinal].filter(Boolean).join(' | ') || ''

    // Campos base (siempre existen)
    const baseData = {
      cliente_nombre: cliente_nombre.trim(),
      cliente_telefono: cliente_telefono.trim(),
      items: itemsVerificados,
      total,
      estado: 'pendiente',
      metodo_pago: metodo_pago || 'efectivo',
      notas: notasBase,
      fecha: hoy,
      hora,
    }

    // Campos extendidos (pueden no existir si no se corrió la migración SQL)
    const extendedData = {
      ...baseData,
      cliente_email: user?.email || null,
      user_id: user?.id || null,
      pago_verificado: false,
      latitud: esDelivery ? (latitud || null) : null,
      longitud: esDelivery ? (longitud || null) : null,
      direccion: direccionFinal,
      descuento,
      cupon_codigo: cuponValido,
      costo_envio_aplicado: costoEnvio,
    }

    // Insertar y obtener el id generado para usar como número de pedido
    let insertedId: number | null = null

    const result1 = await supabase.from('pedidos').insert(extendedData).select('id').single()
    if (!result1.error && result1.data) {
      insertedId = result1.data.id
    } else {
      console.warn('Insert extendido falló, reintentando con campos base:', result1.error?.message)
      const result2 = await supabase.from('pedidos').insert(baseData).select('id').single()
      if (!result2.error && result2.data) {
        insertedId = result2.data.id
      } else {
        console.error('Error al insertar pedido:', result2.error)
        return NextResponse.json({ error: `Error al guardar el pedido: ${result2.error?.message}` }, { status: 500 })
      }
    }

    // El número de pedido es el id autoincremental (1, 2, 3...)
    const newOrderId = `#${insertedId}`
    await supabase.from('pedidos').update({ order_id: newOrderId }).eq('id', insertedId!)

    if (cuponValido) {
      await supabase.rpc('incrementar_uso_cupon', { p_codigo: cuponValido }).maybeSingle()
    }

    const { data: cfg2 } = await supabase.from('configuracion').select('whatsapp_phone').eq('id', 1).maybeSingle()

    const origin = new URL(req.url).origin
    fetch(`${origin}/api/notify-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: newOrderId, cliente_nombre: cliente_nombre.trim(), total,
        metodo_pago: metodo_pago || 'efectivo', items: itemsVerificados,
        latitud: esDelivery ? latitud : null, longitud: esDelivery ? longitud : null,
        direccion: direccionFinal,
      }),
    }).catch(err => console.error('Error en notificación:', err))

    return NextResponse.json({ ok: true, order_id: newOrderId, whatsapp_phone: cfg2?.whatsapp_phone || null })
  } catch (err) {
    console.error('Error en /api/crear-pedido:', err)
    return NextResponse.json({ error: `Error interno: ${err instanceof Error ? err.message : 'desconocido'}` }, { status: 500 })
  }
}
