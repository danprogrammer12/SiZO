// Helper compartido para las pruebas de integración/API (tests/api/**).
// Generaliza el patrón usado en scripts/test-seguridad-rls.mjs:
// - admin: cliente service_role (bypassa RLS, para preparar/limpiar fixtures)
// - ensureUser: crea o actualiza un usuario de prueba *.sizo.test con rol/empresas dados
// - signedClient: cliente anon autenticado como ese usuario (el que SÍ respeta RLS)
// - cleanup: borra todo lo creado, sin importar si la prueba falló
//
// Todas las pruebas de tests/api/ comparten el tenant del ADMIN real (SIZO_ADMIN_EMAIL)
// definido en .env, igual que la suite legacy — no crean un tenant nuevo por corrida
// para evitar acumular tenants huérfanos en Supabase.

import { createClient } from '@supabase/supabase-js'
import { ENV } from './env.js'

export const TEST_PASSWORD = 'PlaywrightQA!2026'

export function adminClient() {
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export async function getTenantId(admin) {
  const { data: { users } } = await admin.auth.admin.listUsers()
  const adminUser = users.find(u => u.email === ENV.SIZO_ADMIN_EMAIL.toLowerCase())
  if (!adminUser) throw new Error(`No existe el usuario ADMIN (${ENV.SIZO_ADMIN_EMAIL}) en Supabase Auth`)
  return { tenantId: adminUser.app_metadata.tenant_id, adminUid: adminUser.id }
}

export async function ensureUser(admin, { email, rol, tenantId, empresasIds = [] }) {
  const { data: { users } } = await admin.auth.admin.listUsers()
  let u = users.find(x => x.email === email)
  const appMeta = { tenant_id: tenantId, role: rol, empresas_ids: empresasIds }
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: TEST_PASSWORD, email_confirm: true, app_metadata: appMeta,
    })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    u = data.user
  } else {
    const { error } = await admin.auth.admin.updateUserById(u.id, { password: TEST_PASSWORD, app_metadata: appMeta })
    if (error) throw new Error(`updateUserById ${email}: ${error.message}`)
  }
  const { error: upsertErr } = await admin.from('usuarios').upsert({
    id: u.id, tenant_id: tenantId, nombre: rol, email, rol,
    activo: true, empresas_ids: empresasIds, updated_by: u.id, creado_por: u.id,
  }, { onConflict: 'id' })
  if (upsertErr) throw new Error(`upsert usuarios ${email}: ${upsertErr.message}`)
  return u.id
}

export async function signedClient(email) {
  const client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return client
}

export async function deleteTestUser(admin, email) {
  const { data: { users } } = await admin.auth.admin.listUsers()
  const u = users.find(x => x.email === email)
  if (!u) return
  await admin.from('usuarios').delete().eq('id', u.id)
  await admin.auth.admin.deleteUser(u.id)
}
