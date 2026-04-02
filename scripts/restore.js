// =============================================
// RESTORE - Contry Burger POS
// Uso: node scripts/restore.js [archivo-backup.json]
// Si no se pasa archivo, usa el backup más reciente
// =============================================

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de entorno. Asegúrate de tener .env.local con SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Orden de borrado (de más dependiente a menos)
// Orden de inserción (de menos dependiente a más)
const TABLAS_ORDEN = [
  'configuracion',
  'cupones',
  'categorias',
  'productos',
  'inventario',
  'recetas',
  'compras',
  'gastos',
  'merma',
  'ventas',
  'pedidos',
  'caja_diaria',
]

function obtenerBackupMasReciente() {
  const backupsDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupsDir)) {
    console.error('❌ No existe la carpeta backups/')
    process.exit(1)
  }
  const archivos = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()

  if (archivos.length === 0) {
    console.error('❌ No hay archivos de backup en backups/')
    process.exit(1)
  }
  return path.join(backupsDir, archivos[0])
}

function preguntar(pregunta) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(pregunta, respuesta => {
      rl.close()
      resolve(respuesta.trim().toLowerCase())
    })
  })
}

async function restaurarTabla(tabla, datos) {
  // 1. Borrar todo lo existente
  const { error: errorBorrar } = await supabase.from(tabla).delete().neq('id', '___inexistente___')
  if (errorBorrar) {
    // Algunos errores de FK son esperados, continuar
    console.warn(`  ⚠️  Borrado ${tabla}: ${errorBorrar.message}`)
  }

  // 2. Insertar datos del backup (si hay)
  if (!datos || datos.length === 0) {
    console.log(`  ✓ ${tabla}: vacío (sin datos que restaurar)`)
    return
  }

  // Insertar en lotes de 100
  const LOTE = 100
  for (let i = 0; i < datos.length; i += LOTE) {
    const lote = datos.slice(i, i + LOTE)
    const { error: errorInsertar } = await supabase.from(tabla).upsert(lote, { onConflict: 'id' })
    if (errorInsertar) {
      console.warn(`  ⚠️  Insertar ${tabla} [lote ${i}]: ${errorInsertar.message}`)
    }
  }

  console.log(`  ✓ ${tabla}: ${datos.length} registros restaurados`)
}

async function restaurar() {
  // Determinar archivo de backup
  let rutaBackup
  const argArchivo = process.argv[2]

  if (argArchivo) {
    rutaBackup = path.isAbsolute(argArchivo)
      ? argArchivo
      : path.join(process.cwd(), 'backups', argArchivo)
  } else {
    rutaBackup = obtenerBackupMasReciente()
  }

  if (!fs.existsSync(rutaBackup)) {
    console.error(`❌ Archivo no encontrado: ${rutaBackup}`)
    process.exit(1)
  }

  const nombreArchivo = path.basename(rutaBackup)
  const backup = JSON.parse(fs.readFileSync(rutaBackup, 'utf8'))

  console.log('\n⚠️  RESTAURAR BASE DE DATOS')
  console.log('════════════════════════════════════════')
  console.log(`  Archivo : ${nombreArchivo}`)
  console.log(`  Fecha   : ${backup.fecha}`)
  console.log('  ESTO BORRARÁ TODA LA DATA ACTUAL')
  console.log('════════════════════════════════════════')

  const confirmacion = await preguntar('\n¿Confirmas? Escribe "si" para continuar: ')
  if (confirmacion !== 'si') {
    console.log('\n❌ Restauración cancelada.\n')
    process.exit(0)
  }

  console.log('\n🔄 Restaurando...\n')

  for (const tabla of TABLAS_ORDEN) {
    const datos = backup.tablas[tabla] ?? []
    process.stdout.write(`  📥 ${tabla}...`)
    await restaurarTabla(tabla, datos)
  }

  console.log('\n✅ Restauración completada')
  console.log(`   Base de datos volvió al estado: ${backup.fecha}\n`)
}

restaurar().catch(err => {
  console.error('❌ Error inesperado:', err.message)
  process.exit(1)
})
