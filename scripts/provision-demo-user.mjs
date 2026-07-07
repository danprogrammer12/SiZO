// Crea/actualiza el usuario demo público (rol CONSULTA, solo empresas [DEMO]).
// Uso: node scripts/provision-demo-user.mjs
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

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SIZO_DEMO_EMAIL    = 'demo@sizosaas.co',
  SIZO_DEMO_PASSWORD = 'DemoSIZO2026!',
  SIZO_DEMO_TENANT   = '33cca128-a52e-49c8-a1b7-1fa123a6fd5a',
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Resolver empresas [DEMO] del tenant de pruebas
  const { data: empresas, error: empErr } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('tenant_id', SIZO_DEMO_TENANT)
    .ilike('nombre', '[DEMO]%')

  if (empErr) { console.error('✗ Error listando empresas demo:', empErr.message); process.exit(1) }
  if (!empresas.length) { console.error('✗ No se encontraron empresas [DEMO] en el tenant de pruebas'); process.exit(1) }

  const empresasIds = [...new Set(empresas.map(e => e.id))]
  console.log(`ℹ Empresas demo encontradas: ${empresas.map(e => e.nombre).join(', ')}`)

  // 2. Buscar o crear el usuario en Auth
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('✗ Error listando usuarios:', listErr.message); process.exit(1) }

  let demoUser = users.find(u => u.email === SIZO_DEMO_EMAIL.toLowerCase())

  if (!demoUser) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email:         SIZO_DEMO_EMAIL.toLowerCase(),
      password:      SIZO_DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { nombre: 'Usuario Demo' },
    })
    if (createErr) { console.error('✗ Error creando usuario demo:', createErr.message); process.exit(1) }
    demoUser = created.user
    console.log(`✓ Usuario demo creado: ${demoUser.id}`)
  } else {
    // Asegura que la contraseña conocida siga funcionando
    const { error: pwErr } = await supabase.auth.admin.updateUserById(demoUser.id, { password: SIZO_DEMO_PASSWORD })
    if (pwErr) { console.error('✗ Error actualizando contraseña demo:', pwErr.message); process.exit(1) }
    console.log(`ℹ Usuario demo ya existía: ${demoUser.id}`)
  }

  // 3. app_metadata — CONSULTA, restringido a las empresas [DEMO]
  const { error: metaErr } = await supabase.auth.admin.updateUserById(demoUser.id, {
    app_metadata: { tenant_id: SIZO_DEMO_TENANT, role: 'CONSULTA', empresas_ids: empresasIds },
  })
  if (metaErr) { console.error('✗ Error seteando app_metadata:', metaErr.message); process.exit(1) }
  console.log('✓ app_metadata seteado: { role: CONSULTA, empresas_ids: [...demo] }')

  // 4. Documento de usuario
  const { error: userErr } = await supabase.from('usuarios').upsert({
    id:           demoUser.id,
    tenant_id:    SIZO_DEMO_TENANT,
    nombre:       'Usuario Demo',
    email:        SIZO_DEMO_EMAIL.toLowerCase(),
    rol:          'CONSULTA',
    activo:       true,
    empresas_ids: empresasIds,
    updated_by:   demoUser.id,
    creado_por:   demoUser.id,
  }, { onConflict: 'id' })

  if (userErr) { console.error('✗ Error creando usuario en tabla usuarios:', userErr.message); process.exit(1) }
  console.log('✓ Usuario demo provisionado en tabla usuarios')

  console.log('\n─────────────────────────────────────────')
  console.log('  DEMO LISTA')
  console.log(`  email:    ${SIZO_DEMO_EMAIL}`)
  console.log(`  password: ${SIZO_DEMO_PASSWORD}`)
  console.log(`  empresas: ${empresasIds.length}`)
  console.log('─────────────────────────────────────────')
}

main().catch(err => {
  console.error('✗ Error inesperado:', err.message)
  process.exit(1)
})
