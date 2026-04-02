// =============================================
// BACKUP - Contry Burger POS
// Uso: node scripts/backup.js
// Guarda un archivo JSON con toda la data en:
//   backups/backup-YYYY-MM-DD.json
// =============================================

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Lee las variables de entorno desde .env.local
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de entorno. Asegúrate de tener .env.local con SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Todas las tablas a respaldar
const TABLAS = [
  'productos',
  'categorias',
  'inventario',
  'recetas',
  'compras',
  'ventas',
  'pedidos',
  'gastos',
  'merma',
  'caja_diaria',
  'configuracion',
  'cupones',
]

async function exportarTabla(tabla) {
  const { data, error } = await supabase.from(tabla).select('*')
  if (error) {
    console.warn(`  ⚠️  ${tabla}: ${error.message}`)
    return []
  }
  return data || []
}

async function hacerBackup() {
  console.log('\n🔄 Iniciando backup de Contry Burger...\n')

  const backup = {
    fecha: new Date().toISOString(),
    proyecto: 'contry-burger-pos',
    tablas: {}
  }

  let totalRegistros = 0

  for (const tabla of TABLAS) {
    process.stdout.write(`  📦 Exportando ${tabla}...`)
    const datos = await exportarTabla(tabla)
    backup.tablas[tabla] = datos
    totalRegistros += datos.length
    console.log(` ${datos.length} registros ✓`)
  }

  // Crear carpeta backups si no existe
  const backupsDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir)
  }

  // Nombre del archivo con fecha y hora
  const ahora = new Date()
  const fechaStr = ahora.toISOString().slice(0, 10) // YYYY-MM-DD
  const horaStr = ahora.toTimeString().slice(0, 8).replace(/:/g, '-') // HH-MM-SS
  const nombreArchivo = `backup-${fechaStr}_${horaStr}.json`
  const rutaArchivo = path.join(backupsDir, nombreArchivo)

  // Guardar archivo
  fs.writeFileSync(rutaArchivo, JSON.stringify(backup, null, 2), 'utf8')

  const tamañoKB = Math.round(fs.statSync(rutaArchivo).size / 1024)

  console.log(`\n✅ Backup completado`)
  console.log(`   Archivo : backups/${nombreArchivo}`)
  console.log(`   Tamaño  : ${tamañoKB} KB`)
  console.log(`   Total   : ${totalRegistros} registros en ${TABLAS.length} tablas\n`)
}

hacerBackup().catch(err => {
  console.error('❌ Error inesperado:', err.message)
  process.exit(1)
})
