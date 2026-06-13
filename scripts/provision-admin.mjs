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
  SIZO_ADMIN_EMAIL,
  SIZO_ADMIN_NOMBRE        = 'Administrador',
  SIZO_TENANT_NOMBRE       = 'Mi Empresa',
  SIZO_TENANT_NOMBRE_CORTO = 'Empresa',
  SIZO_TENANT_TIPO         = 'consultora',
  SIZO_TENANT_PLAN         = 'starter',
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SIZO_ADMIN_EMAIL) {
  console.error('✗ Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y/o SIZO_ADMIN_EMAIL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 0. Buscar usuario en Auth
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('✗ Error listando usuarios:', listErr.message); process.exit(1) }

  const adminUser = users.find(u => u.email === SIZO_ADMIN_EMAIL.toLowerCase())
  if (!adminUser) {
    console.error(`✗ No existe usuario con email ${SIZO_ADMIN_EMAIL} en Supabase Auth.`)
    console.error('  Créalo en: Dashboard → Authentication → Users → "Invite user"')
    process.exit(1)
  }

  const adminUid = adminUser.id

  // 1. Tenant — crear solo si no existe
  let tenantId
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('admin_uid', adminUid)
    .maybeSingle()

  if (existing) {
    tenantId = existing.id
    console.log(`ℹ Tenant ya existe: ${tenantId}`)
  } else {
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        nombre:        SIZO_TENANT_NOMBRE,
        nombre_corto:  SIZO_TENANT_NOMBRE_CORTO,
        tipo:          SIZO_TENANT_TIPO,
        plan:          SIZO_TENANT_PLAN,
        activo:        true,
        email:         SIZO_ADMIN_EMAIL.toLowerCase(),
        admin_uid:     adminUid,
        updated_by:    adminUid,
      })
      .select('id')
      .single()

    if (tenantErr) { console.error('✗ Error creando tenant:', tenantErr.message); process.exit(1) }
    tenantId = tenant.id
    console.log(`✓ Tenant creado: ${tenantId}`)
  }

  // 2. app_metadata
  const { error: metaErr } = await supabase.auth.admin.updateUserById(adminUid, {
    app_metadata: { tenant_id: tenantId, role: 'ADMIN', empresas_ids: [] },
  })
  if (metaErr) { console.error('✗ Error seteando app_metadata:', metaErr.message); process.exit(1) }
  console.log(`✓ app_metadata seteado: { tenant_id, role: ADMIN }`)

  // 3. Documento de usuario
  const { error: userErr } = await supabase.from('usuarios').upsert({
    id:           adminUid,
    tenant_id:    tenantId,
    nombre:       SIZO_ADMIN_NOMBRE,
    email:        SIZO_ADMIN_EMAIL.toLowerCase(),
    rol:          'ADMIN',
    activo:       true,
    empresas_ids: [],
    updated_by:   adminUid,
    creado_por:   adminUid,
  }, { onConflict: 'id' })

  if (userErr) { console.error('✗ Error creando usuario:', userErr.message); process.exit(1) }
  console.log(`✓ Usuario ADMIN provisionado`)

  console.log('\n─────────────────────────────────────────')
  console.log('  PROVISIÓN COMPLETADA')
  console.log(`  tenant_id: ${tenantId}`)
  console.log('  Cierra sesión y vuelve a entrar para que')
  console.log('  el JWT recoja el nuevo app_metadata.')
  console.log('─────────────────────────────────────────')
}

main().catch(err => {
  console.error('✗ Error inesperado:', err.message)
  process.exit(1)
})
