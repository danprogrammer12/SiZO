// SIZO — Regresión: Edge Functions críticas de aprovisionamiento
// ─────────────────────────────────────────────────────────────────────
// registrar-tenant: autoregistro público (sin auth previa) — crea tenant
//   + usuario ADMIN en un solo paso. Es el flujo de ventas self-service.
// crear-usuario: invitación de usuarios DENTRO de un tenant existente,
//   solo invocable por un caller ADMIN autenticado del mismo tenant.
//
// Corre contra las funciones desplegadas de verdad (no hay mock de Deno
// Edge Functions) — requiere que estén desplegadas en el proyecto de .env.
//
// Efectos secundarios: crea tenants/usuarios `qa-pw-*@sizo.test` /
// `[QA-PW EdgeFn] ...`. Se limpian en afterAll pase lo que pase.

import { test, expect } from '@playwright/test'
import { adminClient, getTenantId, ensureUser, signedClient, deleteTestUser } from '../helpers/supabase-test-context.js'
import { ENV } from '../helpers/env.js'

const admin = adminClient()
const runId = Date.now()

async function invokeEdge(fnName, body, { accessToken } = {}) {
  const headers = { 'Content-Type': 'application/json', apikey: ENV.SUPABASE_ANON_KEY }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const res = await fetch(`${ENV.SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

test.describe('registrar-tenant (autoregistro público)', () => {
  const email = `qa-pw-tenant-${runId}@sizo.test`
  let createdUid, createdTenantId

  test.afterAll(async () => {
    if (createdTenantId) await admin.from('tenants').delete().eq('id', createdTenantId)
    if (createdUid) {
      await admin.from('usuarios').delete().eq('id', createdUid)
      await admin.auth.admin.deleteUser(createdUid)
    }
  })

  test('crea tenant + usuario ADMIN y devuelve 201', async () => {
    const { status, data } = await invokeEdge('registrar-tenant', {
      empresaNombre: `[QA-PW EdgeFn] Empresa ${runId}`,
      contactoNombre: 'QA Playwright',
      email,
      password: 'PlaywrightQA!2026',
    })
    expect(status, JSON.stringify(data)).toBe(201)
    expect(data.uid).toBeTruthy()
    expect(data.tenant_id).toBeTruthy()
    createdUid = data.uid
    createdTenantId = data.tenant_id
  })

  test('el usuario creado queda como ADMIN de su propio tenant nuevo (app_metadata correcto)', async () => {
    const { data: { user } } = await admin.auth.admin.getUserById(createdUid)
    expect(user.app_metadata.role).toBe('ADMIN')
    expect(user.app_metadata.tenant_id).toBe(createdTenantId)
  })

  test('la fila en `usuarios` y en `tenants` quedó consistente', async () => {
    const { data: fila } = await admin.from('usuarios').select('rol, tenant_id, activo').eq('id', createdUid).single()
    expect(fila.rol).toBe('ADMIN')
    expect(fila.tenant_id).toBe(createdTenantId)
    expect(fila.activo).toBe(true)

    const { data: tenant } = await admin.from('tenants').select('estado, admin_uid').eq('id', createdTenantId).single()
    expect(tenant.estado).toBe('trial')
    expect(tenant.admin_uid).toBe(createdUid)
  })

  test('rechaza un correo ya registrado con 409', async () => {
    const { status, data } = await invokeEdge('registrar-tenant', {
      empresaNombre: 'Duplicado', contactoNombre: 'QA', email, password: 'PlaywrightQA!2026',
    })
    expect(status, JSON.stringify(data)).toBe(409)
  })

  test('rechaza body incompleto con 400', async () => {
    const { status } = await invokeEdge('registrar-tenant', { email: 'incompleto@sizo.test' })
    expect(status).toBe(400)
  })
})

test.describe('crear-usuario (invitación dentro de un tenant)', () => {
  const EMAIL_ADMIN_CALLER = 'qa-admin-edgefn@sizo.test'
  const EMAIL_NUEVO = `qa-pw-invitado-${runId}@sizo.test`
  let tenantId, adminUid, nuevoUid

  test.beforeAll(async () => {
    ;({ tenantId, adminUid } = await getTenantId(admin))
    await ensureUser(admin, { email: EMAIL_ADMIN_CALLER, rol: 'ADMIN', tenantId, empresasIds: [] })
  })

  test.afterAll(async () => {
    if (nuevoUid) {
      await admin.from('usuarios').delete().eq('id', nuevoUid)
      await admin.auth.admin.deleteUser(nuevoUid)
    }
    await deleteTestUser(admin, EMAIL_ADMIN_CALLER)
  })

  test('un ADMIN autenticado puede crear un usuario en su tenant', async () => {
    const cAdmin = await signedClient(EMAIL_ADMIN_CALLER)
    const { data: { session } } = await cAdmin.auth.getSession()

    const { status, data } = await invokeEdge('crear-usuario', {
      email: EMAIL_NUEVO, nombre: 'QA Invitado', rol: 'CONSULTA', empresasIds: [],
    }, { accessToken: session.access_token })

    expect(status, JSON.stringify(data)).toBe(201)
    expect(data.uid).toBeTruthy()
    expect(data.tenant_id).toBe(tenantId)
    nuevoUid = data.uid

    const { data: fila } = await admin.from('usuarios').select('rol, tenant_id').eq('id', nuevoUid).single()
    expect(fila.rol).toBe('CONSULTA')
    expect(fila.tenant_id).toBe(tenantId)
  })

  test('rechaza el rol ROOT con 400 (no está en ROLES_VALIDOS)', async () => {
    // Nota: index.ts también tiene un chequeo explícito `rol === 'ROOT' → 403`,
    // pero es código muerto — la validación contra ROLES_VALIDOS (que no incluye
    // ROOT) siempre responde 400 primero. Este test documenta el comportamiento
    // real, no el que "debería" ser; si se reordena la validación en el futuro,
    // este test debe actualizarse a 403.
    const cAdmin = await signedClient(EMAIL_ADMIN_CALLER)
    const { data: { session } } = await cAdmin.auth.getSession()
    const { status } = await invokeEdge('crear-usuario', {
      email: `qa-pw-root-${runId}@sizo.test`, nombre: 'QA', rol: 'ROOT', empresasIds: [],
    }, { accessToken: session.access_token })
    expect(status).toBe(400)
  })

  test('un caller sin sesión (sin token) es rechazado con 401', async () => {
    const { status } = await invokeEdge('crear-usuario', {
      email: `qa-pw-sinauth-${runId}@sizo.test`, nombre: 'QA', rol: 'CONSULTA', empresasIds: [],
    })
    expect(status).toBe(401)
  })

  test('un caller NO-ADMIN (CONSULTA) es rechazado con 403', async () => {
    const EMAIL_CONSULTA = 'qa-consulta-edgefn@sizo.test'
    await ensureUser(admin, { email: EMAIL_CONSULTA, rol: 'CONSULTA', tenantId, empresasIds: [] })
    const cConsulta = await signedClient(EMAIL_CONSULTA)
    const { data: { session } } = await cConsulta.auth.getSession()

    const { status } = await invokeEdge('crear-usuario', {
      email: `qa-pw-noautorizado-${runId}@sizo.test`, nombre: 'QA', rol: 'CONSULTA', empresasIds: [],
    }, { accessToken: session.access_token })

    expect(status).toBe(403)
    await deleteTestUser(admin, EMAIL_CONSULTA)
  })
})
