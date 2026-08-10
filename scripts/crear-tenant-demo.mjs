// Crea un tenant nuevo + su usuario ADMIN inicial con contraseña genérica
// (mismo patrón que la Edge Function crear-tenant, pero con password directa
// porque el link de recuperación está deshabilitado por ahora).
// Uso: node scripts/crear-tenant-demo.mjs
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
  TENANT_DEMO_NOMBRE        = 'Empresa Demo SG-SST',
  TENANT_DEMO_NOMBRE_CORTO  = 'Demo SG-SST',
  TENANT_DEMO_TIPO          = 'consultora',
  TENANT_DEMO_PLAN          = 'starter',
  TENANT_DEMO_ADMIN_EMAIL   = 'admin@empresademo.com',
  TENANT_DEMO_ADMIN_NOMBRE  = 'Administrador Demo',
  TENANT_DEMO_ADMIN_PASSWORD = 'DemoSGSST2026!',
} = process.env
const SIZO_TENANT_NOMBRE = TENANT_DEMO_NOMBRE
const SIZO_TENANT_NOMBRE_CORTO = TENANT_DEMO_NOMBRE_CORTO
const SIZO_TENANT_TIPO = TENANT_DEMO_TIPO
const SIZO_TENANT_PLAN = TENANT_DEMO_PLAN
const SIZO_ADMIN_EMAIL = TENANT_DEMO_ADMIN_EMAIL
const SIZO_ADMIN_NOMBRE = TENANT_DEMO_ADMIN_NOMBRE
const SIZO_ADMIN_PASSWORD = TENANT_DEMO_ADMIN_PASSWORD

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const email = SIZO_ADMIN_EMAIL.toLowerCase().trim()

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('✗ Error listando usuarios:', listErr.message); process.exit(1) }
  if (users.find(u => u.email === email)) {
    console.error(`✗ Ya existe una cuenta con ese correo: ${email}`)
    process.exit(1)
  }

  // 1. Usuario ADMIN en Auth (sin tenant_id aún)
  const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password:      SIZO_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { nombre: SIZO_ADMIN_NOMBRE },
    app_metadata:  {},
  })
  if (createErr) { console.error('✗ Error creando usuario:', createErr.message); process.exit(1) }
  const adminUid = newAuth.user.id
  console.log(`✓ Usuario Auth creado: ${adminUid}`)

  // 2. Tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      nombre:        SIZO_TENANT_NOMBRE,
      nombre_corto:  SIZO_TENANT_NOMBRE_CORTO,
      tipo:          SIZO_TENANT_TIPO,
      plan:          SIZO_TENANT_PLAN,
      activo:        true,
      email,
      admin_uid:     adminUid,
      updated_by:    adminUid,
    })
    .select('id')
    .single()

  if (tenantErr) {
    await supabase.auth.admin.deleteUser(adminUid)
    console.error('✗ Error creando tenant:', tenantErr.message); process.exit(1)
  }
  const tenantId = tenant.id
  console.log(`✓ Tenant creado: ${tenantId}`)

  // 3. app_metadata
  const { error: metaErr } = await supabase.auth.admin.updateUserById(adminUid, {
    app_metadata: { tenant_id: tenantId, role: 'ADMIN', empresas_ids: [] },
  })
  if (metaErr) {
    await supabase.from('tenants').delete().eq('id', tenantId)
    await supabase.auth.admin.deleteUser(adminUid)
    console.error('✗ Error seteando app_metadata:', metaErr.message); process.exit(1)
  }
  console.log('✓ app_metadata seteado: { tenant_id, role: ADMIN }')

  // 4. Documento de usuario
  const { error: userErr } = await supabase.from('usuarios').insert({
    id:           adminUid,
    tenant_id:    tenantId,
    nombre:       SIZO_ADMIN_NOMBRE,
    email,
    rol:          'ADMIN',
    activo:       true,
    empresas_ids: [],
    updated_by:   adminUid,
    creado_por:   adminUid,
  })
  if (userErr) {
    await supabase.from('tenants').delete().eq('id', tenantId)
    await supabase.auth.admin.deleteUser(adminUid)
    console.error('✗ Error creando usuario en tabla usuarios:', userErr.message); process.exit(1)
  }
  console.log('✓ Usuario ADMIN provisionado')

  console.log('\n─────────────────────────────────────────')
  console.log('  TENANT DEMO CREADO')
  console.log(`  tenant_id: ${tenantId}`)
  console.log(`  email:     ${email}`)
  console.log(`  password:  ${SIZO_ADMIN_PASSWORD}`)
  console.log('  Recomienda cambiar la contraseña en el primer login.')
  console.log('─────────────────────────────────────────')
}

main().catch(err => {
  console.error('✗ Error inesperado:', err.message)
  process.exit(1)
})
