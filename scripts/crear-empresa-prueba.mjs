// Crea una empresa de prueba nueva en el tenant de pruebas.
// Uso: node scripts/crear-empresa-prueba.mjs
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: admin, error: errAdmin } = await supabase
    .from('usuarios')
    .select('id, email, rol')
    .eq('tenant_id', TENANT_ID)
    .eq('rol', 'ADMIN')
    .limit(1)
    .single()
  if (errAdmin) { console.error('✗ Error buscando ADMIN del tenant:', errAdmin.message); process.exit(1) }
  console.log(`ℹ Usando ADMIN: ${admin.email} (${admin.id})`)

  const { data: empresa, error } = await supabase
    .from('empresas')
    .insert({
      tenant_id: TENANT_ID,
      nombre: 'Empresa de Prueba SIZO',
      ciudad: 'Bogotá',
      nit: '900123456-7',
      trab: 10,
      nivel_riesgo: 'III',
      clase_riesgo: 'III',
      copasst: 'copasst',
      activa: true,
      creado_por: admin.id,
      updated_by: admin.id,
    })
    .select()
    .single()
  if (error) { console.error('✗ Error creando empresa:', error.message); process.exit(1) }

  console.log('\n─────────────────────────────────────────')
  console.log('  EMPRESA DE PRUEBA CREADA')
  console.log(`  id: ${empresa.id}`)
  console.log(`  nombre: ${empresa.nombre}`)
  console.log('─────────────────────────────────────────')
}

main().catch(err => {
  console.error('✗ Error inesperado:', err.message)
  process.exit(1)
})
