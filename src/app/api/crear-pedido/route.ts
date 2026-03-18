import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente con service role para leer precios reales (no manipulables por el cliente)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado
    const cookieStore = cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const {
      items,           // [{ producto_id, cantidad }] — SIN precios
      cliente_nombre,
      cliente_telefono,
      notas,
      metodo_pago,
      latitud,
      longitud,
      direccion,
      cupon_codigo,
    } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 })
    }
    if (!cliente_nombre?.trim() || !cliente_telefono?.trim()) {
      return NextResponse.json({ error: 'Nombre y teléfono son requeridos' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // --- Leer precios reales desde la base de datos ---
    const productoIds = items.map((i: { producto_id: string }) => i.producto_id)
    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, activo, agotado')
      .in('id', productoIds)

    if (prodError || !productos) {
      return NextResponse.json({ error: 'Error al leer productos' }, { status: 500 })
    }

    // Calcular subtotal con precios del servidor
    let subtotal = 0
    const itemsVerificados: { producto_id: string; nombre: string; cantidad: number; precio_unitario: number; subtotal: number }[] = []

    for (const item of items) {
      const producto = productos.find((p) => p.id === item.producto_id)
      if (!producto) return NextResponse.json({ error: `Producto no encontrado: ${item.producto_id}` }, { status: 400 })
      if (!producto.activo) return NextResponse.json({ error: `Producto no disponible: ${producto.nombre}` }, { status: 400 })
      if (producto.agotado) return NextResponse.json({ error: `Producto agotado: ${producto.nombre}` }, { status: 400 })

      const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1))
      const precio = Number(producto.precio_venta)
      const itemSubtotal = precio * cantidad
      subtotal += itemSubtotal

      itemsVerificados.push({
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad,
        precio_unitario: precio,
        subtotal: itemSubtotal,
      })
    }

    // --- Leer configuración (costo envío, pedido mínimo) ---
    const { data: cfg } = await supabase
      .from('configuracion')
      .select('costo_envio, pedido_minimo, whatsapp_phone')
      .eq('id', 1)
      .single()

    const costoEnvio = latitud ? Number(cfg?.costo_envio ?? 0) : 0
    const pedidoMinimo = Number(cfg?.pedido_minimo ?? 0)

    if (pedidoMinimo > 0 && subtotal < pedidoMinimo) {
      return NextResponse.json({ error: `El pedido mínimo es $${pedidoMinimo.toFixed(2)}` }, { status: 400 })
    }

    // --- Validar cupón en servidor ---
    let descuento = 0
    let cuponValido: string | null = null

    if (cupon_codigo) {
      const { data: cupon } = await supabase
        .from('cupones')
        .select('*')
        .eq('codigo', String(cupon_codigo).toUpperCase().trim())
        .eq('activo', true)
        .single()

      if (cupon) {
        const noVencido = !cupon.fecha_vencimiento || new Date(cupon.fecha_vencimiento) >= new Date()
        const hayUsos = cupon.usos_actuales < cupon.usos_max
        if (noVencido && hayUsos) {
          descuento = cupon.tipo === 'porcentaje'
            ? (subtotal * Number(cupon.valor)) / 100
            : Number(cupon.valor)
          descuento = Math.min(descuento, subtotal)
          cuponValido = cupon.codigo
        }
      }
    }

    const total = subtotal + costoEnvio - descuento

    // --- Generar order_id secuencial ---
    const { data: last } = await supabase
      .from('pedidos')
      .select('order_id')
      .order('id', { ascending: false })
      .limit(1)

    let newOrderId = 'PED001'
    if (last && last.length > 0) {
      const num = parseInt(String(last[0].order_id || 'PED000').replace('PED', '')) || 0
      newOrderId = `PED${String(num + 1).padStart(3, '0')}`
    }

    const hora = new Date().toTimeString().split(' ')[0]
    const hoy = new Date().toISOString().split('T')[0]

    // --- Insertar pedido ---
    const { error: insertError } = await supabase
      .from('pedidos')
      .insert({
        order_id: newOrderId,
        cliente_nombre: cliente_nombre.trim(),
        cliente_telefono: cliente_telefono.trim(),
        cliente_email: user.email || null,
        user_id: user.id,
        items: itemsVerificados,
        total,
        estado: 'pendiente',
        metodo_pago: metodo_pago || 'efectivo',
        notas: notas?.trim() || '',
        fecha: hoy,
        hora,
        pago_verificado: false,
        latitud: latitud || null,
        longitud: longitud || null,
        direccion: direccion?.trim() || null,
        descuento,
        cupon_codigo: cuponValido,
        costo_envio_aplicado: costoEnvio,
      })

    if (insertError) {
      console.error('Error insertando pedido:', insertError)
      return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
    }

    // Incrementar uso del cupón
    if (cuponValido) {
      await supabase.rpc('incrementar_uso_cupon', { p_codigo: cuponValido }).maybeSingle()
    }

    // Notificación WhatsApp (no bloqueante)
    const origin = new URL(req.url).origin
    fetch(`${origin}/api/notify-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: newOrderId,
        cliente_nombre: cliente_nombre.trim(),
        total,
        metodo_pago: metodo_pago || 'efectivo',
        items: itemsVerificados,
        latitud,
        longitud,
        direccion: direccion?.trim() || null,
      }),
    }).catch(() => {})

    return NextResponse.json({ ok: true, order_id: newOrderId })
  } catch (err) {
    console.error('Error en crear-pedido:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
