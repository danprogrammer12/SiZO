// Provisiona la primera cuenta ROOT (administrador de plataforma, sin tenant).
// Necesario porque crear-usuario/actualizar-usuario exigen que quien llama YA
// sea ROOT — la primera cuenta no tiene forma de crearse desde el front.
// Uso: SIZO_ROOT_EMAIL=... node scripts/provision-root.mjs
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
  SIZO_ROOT_EMAIL,
  SIZO_ROOT_NOMBRE = 'Root',
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SIZO_ROOT_EMAIL) {
  console.error('✗ Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y/o SIZO_ROOT_EMAIL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const email = SIZO_ROOT_EMAIL.toLowerCase().trim()

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('✗ Error listando usuarios:', listErr.message); process.exit(1) }

  let rootUser = users.find(u => u.email === email)

  if (rootUser) {
    console.log(`ℹ Usuario ya existe (${rootUser.id}), solo actualizo app_metadata`)
    const { error } = await supabase.auth.admin.updateUserById(rootUser.id, {
      app_metadata: { role: 'ROOT' },
    })
    if (error) { console.error('✗ Error seteando app_metadata:', error.message); process.exit(1) }
  } else {
    const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nombre: SIZO_ROOT_NOMBRE },
      app_metadata:  { role: 'ROOT' },
    })
    if (createErr) { console.error('✗ Error creando usuario:', createErr.message); process.exit(1) }
    rootUser = newAuth.user
    console.log(`✓ Usuario ROOT creado: ${rootUser.id}`)

    const { error: inviteErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: process.env.APP_URL || '' },
    })
    if (inviteErr) console.warn('⚠ No se pudo generar link de invitación:', inviteErr.message)
    else console.log('✓ Link de invitación generado (revisa el correo o el link en la respuesta de Supabase)')
  }

  console.log('\n─────────────────────────────────────────')
  console.log('  PROVISIÓN ROOT COMPLETADA')
  console.log(`  uid: ${rootUser.id}`)
  console.log(`  email: ${email}`)
  console.log('  app_metadata: { role: "ROOT" } — sin tenant_id')
  console.log('─────────────────────────────────────────')
}

main().catch(err => {
  console.error('✗ Error inesperado:', err.message)
  process.exit(1)
})
