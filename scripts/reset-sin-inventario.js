// =============================================
// RESET SIN INVENTARIO - Contry Burger POS
// Uso: node scripts/reset-sin-inventario.js
//
// Limpia datos transaccionales SIN afectar inventario:
//   - pedidos, ventas, chat, resenas, caja_diaria
//   - gastos, merma, compras
//
// NO toca: inventario, productos, recetas, categorias, config, cupones
// =============================================

const { createClient } = require('@supabase/supabase-js')
const readline = require('readline')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan variables de entorno en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function preguntar(pregunta) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(pregunta, respuesta => {
      rl.close()
      resolve(respuesta.trim().toLowerCase())
    })
  })
}

async function borrarTabla(tabla) {
  const { error } = await supabase.from(tabla).delete().gte('id', 0)
  if (error) {
    // Si id no es integer (uuid), intentar con neq
    const { error: err2 } = await supabase.from(tabla).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (err2) {
      console.log(`  !! ${tabla}: ${err2.message}`)
      return false
    }
  }
  console.log(`  -> ${tabla}: limpiado`)
  return true
}

async function reset() {
  console.log('\n========================================')
  console.log('  RESET SIN AFECTAR INVENTARIO')
  console.log('========================================')
  console.log('')
  console.log('  SE BORRA:')
  console.log('    - pedidos (todos)')
  console.log('    - ventas (todas)')
  console.log('    - chat_mensajes (todos)')
  console.log('    - resenas (todas)')
  console.log('    - caja_diaria (todas)')
  console.log('    - gastos (todos)')
  console.log('    - merma (toda)')
  console.log('    - compras (todas)')
  console.log('')
  console.log('  NO SE TOCA:')
  console.log('    - inventario (stock actual se conserva)')
  console.log('    - productos, recetas, categorias')
  console.log('    - configuracion, cupones')
  console.log('========================================\n')

  const resp = await preguntar('Escribe "si" para confirmar: ')
  if (resp !== 'si') {
    console.log('\nCancelado.\n')
    process.exit(0)
  }

  console.log('\nLimpiando...\n')

  // Orden: primero tablas dependientes
  await borrarTabla('chat_mensajes')
  await borrarTabla('resenas')
  await borrarTabla('ventas')
  await borrarTabla('pedidos')
  await borrarTabla('caja_diaria')
  await borrarTabla('gastos')
  await borrarTabla('merma')
  await borrarTabla('compras')

  // Verificar
  console.log('\n--- Verificacion ---')
  for (const t of ['pedidos', 'ventas', 'chat_mensajes', 'resenas', 'caja_diaria', 'gastos', 'merma', 'compras']) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t}: ${count || 0} registros`)
  }

  // Verificar inventario
  const { count: invCount } = await supabase.from('inventario').select('*', { count: 'exact', head: true })
  console.log(`  inventario: ${invCount || 0} ingredientes (SIN CAMBIOS)`)

  console.log('\n✅ Listo. Sistema limpio para empezar. Inventario intacto.\n')
}

reset().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
