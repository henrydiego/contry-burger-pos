// =============================================
// RESET PRUEBAS - Contry Burger POS
// Uso: node scripts/reset-pruebas.js
//
// Limpia TODOS los datos transaccionales para empezar de cero:
//   - pedidos, ventas, chat, resenas, caja_diaria
//   - gastos, merma, compras
//   - resetea inventario (stock = inicial, consumo = 0)
//
// NO toca: productos, recetas, categorias, config, cupones
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
  const { error } = await supabase.from(tabla).delete().neq('id', '___inexistente___')
  if (error) {
    console.log(`  !! ${tabla}: ${error.message}`)
    return false
  }
  console.log(`  -> ${tabla}: limpiado`)
  return true
}

async function reset() {
  console.log('\n========================================')
  console.log('  RESET DE DATOS DE PRUEBA')
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
  console.log('  SE RESETEA:')
  console.log('    - inventario (stock vuelve al inicial)')
  console.log('')
  console.log('  NO SE TOCA:')
  console.log('    - productos, recetas, categorias')
  console.log('    - configuracion, cupones')
  console.log('========================================\n')

  const resp = await preguntar('Escribe "si" para confirmar: ')
  if (resp !== 'si') {
    console.log('\nCancelado.\n')
    process.exit(0)
  }

  console.log('\nLimpiando...\n')

  // Orden: primero tablas dependientes de pedidos
  await borrarTabla('chat_mensajes')
  await borrarTabla('resenas')
  await borrarTabla('ventas')
  await borrarTabla('pedidos')
  await borrarTabla('caja_diaria')
  await borrarTabla('gastos')
  await borrarTabla('merma')
  await borrarTabla('compras')

  // Resetear inventario
  const { data: inv } = await supabase.from('inventario').select('ingrediente_id, stock_inicial')
  if (inv) {
    for (const item of inv) {
      await supabase.from('inventario').update({
        stock_actual: item.stock_inicial,
        consumo_total: 0,
      }).eq('ingrediente_id', item.ingrediente_id)
    }
    console.log(`  -> inventario: ${inv.length} ingredientes reseteados (stock = inicial, consumo = 0)`)
  }

  // Verificar
  console.log('\n--- Verificacion ---')
  for (const t of ['pedidos', 'ventas', 'chat_mensajes', 'resenas', 'caja_diaria', 'gastos', 'merma', 'compras']) {
    const { data } = await supabase.from(t).select('id', { count: 'exact', head: true })
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t}: ${count || 0} registros`)
  }

  const { data: negativo } = await supabase.from('inventario').select('nombre').lt('stock_actual', 0)
  console.log(`  inventario negativo: ${negativo?.length || 0} ingredientes`)

  console.log('\nListo. Sistema limpio para empezar.\n')
}

reset().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
