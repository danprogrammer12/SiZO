// Borra todos los datos operativos del tenant de pruebas (empresas y sus datos hijos)
// para dejarlo limpio de cara a nuevas pruebas. NO toca `tenants` ni `usuarios` — el
// login ADMIN de pruebas sigue funcionando.
// Uso: node scripts/reset-tenant-pruebas.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  for (const linea of env.split('\n')) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const i = limpia.indexOf('=')
    if (i === -1) continue
    const k = limpia.slice(0, i).trim()
    const v = limpia.slice(i + 1).trim()
    if (!(k in process.env)) process.env[k] = v
  }
} catch { /* .env opcional */ }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const TENANT_ID = 'e2816d5d-1d6e-499f-b272-bb04cd22ac8b'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Orden: tablas hijas primero, `empresas` al final (FK not null hacia empresas).
const TABLAS = [
  'entrega_epp', 'matriz_epp', 'matriz_riesgos', 'documentos', 'documentos_sst',
  'actas', 'archivos', 'casos_medicos', 'auditorias', 'eval_estructura',
  'configuracion_obs', 'configuracion', 'plan_actividades', 'capacitaciones',
  'inspecciones', 'acciones', 'ausencias', 'accidentes', 'seguimiento', 'empresas',
]

async function borrarStorage() {
  const { data: raiz, error: errRaiz } = await supabase.storage.from('documentos').list(TENANT_ID)
  if (errRaiz) { console.error(`✗ Error listando storage:`, errRaiz.message); process.exit(1) }

  const rutas = []
  for (const item of raiz) {
    if (item.id === null) {
      // es una subcarpeta (empresa_id) — listar su contenido
      const { data: hijos, error } = await supabase.storage.from('documentos').list(`${TENANT_ID}/${item.name}`)
      if (error) { console.error(`✗ Error listando subcarpeta ${item.name}:`, error.message); process.exit(1) }
      for (const h of hijos) rutas.push(`${TENANT_ID}/${item.name}/${h.name}`)
    } else {
      rutas.push(`${TENANT_ID}/${item.name}`)
    }
  }

  if (rutas.length === 0) {
    console.log('ℹ Sin archivos en storage para este tenant')
    return
  }

  const { error } = await supabase.storage.from('documentos').remove(rutas)
  if (error) { console.error('✗ Error borrando archivos de storage:', error.message); process.exit(1) }
  console.log(`✓ Borrados ${rutas.length} archivo(s) de storage`)
}

async function borrarTablas() {
  for (const tabla of TABLAS) {
    const { error, count } = await supabase
      .from(tabla)
      .delete({ count: 'exact' })
      .eq('tenant_id', TENANT_ID)
    if (error) { console.error(`✗ Error borrando ${tabla}:`, error.message); process.exit(1) }
    console.log(`✓ ${tabla}: ${count ?? 0} fila(s) borrada(s)`)
  }
}

async function main() {
  console.log(`Reseteando datos del tenant ${TENANT_ID}...\n`)
  await borrarStorage()
  await borrarTablas()
  console.log('\n─────────────────────────────────────────')
  console.log('  RESET COMPLETADO — tenant y usuarios intactos')
  console.log('─────────────────────────────────────────')
}

main().catch(err => {
  console.error('✗ Error inesperado:', err.message)
  process.exit(1)
})
