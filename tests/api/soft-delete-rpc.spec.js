// SIZO — Regresión: soft-delete vía RPC SECURITY DEFINER
// ─────────────────────────────────────────────────────────────────────
// Contexto (ver CLAUDE.md, notas 2026-07-16): el UPDATE directo vía
// PostgREST para poner `activo=false` queda bloqueado por RLS con 42501
// en `documentos`, `matriz_riesgos` y `actas`, pese a que la política es
// correcta — causa raíz nunca determinada. El workaround en producción
// son 3 funciones `SECURITY DEFINER` (supabase/migrations/012 y 013):
//   soft_delete_documento(uuid)
//   soft_delete_matriz_riesgos(uuid)
//   soft_delete_acta(uuid)
// que validan permisos en PL/pgSQL y actualizan como dueño de tabla.
// `db.js` (softDelete()) las invoca automáticamente para esas 3 tablas.
//
// Esta suite es la prueba de regresión de ese workaround: si alguien
// vuelve a intentar "arreglar" el soft-delete quitando el RPC, o si una
// migración futura rompe alguna de las 3 funciones, esto debe fallar.
//
// Requiere .env con SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// / SIZO_ADMIN_EMAIL apuntando a un proyecto Supabase real (no hay mock de RLS).
//
// Efectos secundarios: crea un usuario `qa-admin-softdelete@sizo.test` y una
// empresa `[QA-PW] Soft Delete` en el tenant del ADMIN configurado en .env.
// Se limpian todos al final (afterAll), incluso si algún test falla.

import { test, expect } from '@playwright/test'
import { adminClient, getTenantId, ensureUser, signedClient, deleteTestUser } from '../helpers/supabase-test-context.js'

const TEST_EMAIL = 'qa-admin-softdelete@sizo.test'
const EMPRESA_NOMBRE = '[QA-PW] Soft Delete'

let admin, tenantId, adminUid, empresaId, cAdmin

test.beforeAll(async () => {
  admin = adminClient()
  ;({ tenantId } = await getTenantId(admin))
  adminUid = await ensureUser(admin, { email: TEST_EMAIL, rol: 'ADMIN', tenantId, empresasIds: [] })
  cAdmin = await signedClient(TEST_EMAIL)

  const { data: existing } = await admin.from('empresas').select('id')
    .eq('tenant_id', tenantId).eq('nombre', EMPRESA_NOMBRE).maybeSingle()
  if (existing) {
    empresaId = existing.id
  } else {
    const { data, error } = await admin.from('empresas').insert({
      tenant_id: tenantId, nombre: EMPRESA_NOMBRE, ciudad: 'QA',
      trab: 1, activa: true, creado_por: adminUid, updated_by: adminUid,
    }).select('id').single()
    if (error) throw new Error(`crear empresa fixture: ${error.message}`)
    empresaId = data.id
  }
})

test.afterAll(async () => {
  if (empresaId) {
    await admin.from('documentos').delete().eq('empresa_id', empresaId)
    await admin.from('matriz_riesgos').delete().eq('empresa_id', empresaId)
    await admin.from('actas').delete().eq('empresa_id', empresaId)
    await admin.from('empresas').delete().eq('id', empresaId)
  }
  await deleteTestUser(admin, TEST_EMAIL)
})

test('soft_delete_documento marca activo=false, deleted_at y updated_by', async () => {
  const { data: doc, error: insErr } = await admin.from('documentos').insert({
    tenant_id: tenantId, empresa_id: empresaId, categoria: 'otro',
    nombre: 'QA soft-delete doc', activo: true, creado_por: adminUid, updated_by: adminUid,
  }).select('id').single()
  expect(insErr, insErr?.message).toBeNull()

  const { error: rpcErr } = await cAdmin.rpc('soft_delete_documento', { p_id: doc.id })
  expect(rpcErr, rpcErr?.message).toBeNull()

  const { data: row, error: readErr } = await admin.from('documentos')
    .select('activo, deleted_at, updated_by').eq('id', doc.id).single()
  expect(readErr, readErr?.message).toBeNull()
  expect(row.activo).toBe(false)
  expect(row.deleted_at).not.toBeNull()
  expect(row.updated_by).toBe(adminUid)
})

test('soft_delete_matriz_riesgos marca activo=false, deleted_at y updated_by', async () => {
  const { data: riesgo, error: insErr } = await admin.from('matriz_riesgos').insert({
    tenant_id: tenantId, empresa_id: empresaId,
    proceso: 'QA', actividad: 'QA', peligro_categoria: 'fisico', peligro_descripcion: 'QA',
    nivel_deficiencia: 2, nivel_exposicion: 1, nivel_consecuencia: 10,
    activo: true, creado_por: adminUid, updated_by: adminUid,
  }).select('id').single()
  expect(insErr, insErr?.message).toBeNull()

  const { error: rpcErr } = await cAdmin.rpc('soft_delete_matriz_riesgos', { p_id: riesgo.id })
  expect(rpcErr, rpcErr?.message).toBeNull()

  const { data: row, error: readErr } = await admin.from('matriz_riesgos')
    .select('activo, deleted_at, updated_by').eq('id', riesgo.id).single()
  expect(readErr, readErr?.message).toBeNull()
  expect(row.activo).toBe(false)
  expect(row.deleted_at).not.toBeNull()
  expect(row.updated_by).toBe(adminUid)
})

test('soft_delete_acta marca activo=false, deleted_at y updated_by', async () => {
  const { data: acta, error: insErr } = await admin.from('actas').insert({
    tenant_id: tenantId, empresa_id: empresaId, tipo: 'copasst', fecha: '2026-01-01',
    activo: true, creado_por: adminUid, updated_by: adminUid,
  }).select('id').single()
  expect(insErr, insErr?.message).toBeNull()

  const { error: rpcErr } = await cAdmin.rpc('soft_delete_acta', { p_id: acta.id })
  expect(rpcErr, rpcErr?.message).toBeNull()

  const { data: row, error: readErr } = await admin.from('actas')
    .select('activo, deleted_at, updated_by').eq('id', acta.id).single()
  expect(readErr, readErr?.message).toBeNull()
  expect(row.activo).toBe(false)
  expect(row.deleted_at).not.toBeNull()
  expect(row.updated_by).toBe(adminUid)
})

test('soft_delete_documento rechaza un id inexistente', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const { error } = await cAdmin.rpc('soft_delete_documento', { p_id: fakeId })
  expect(error, 'debería fallar con "Documento no encontrado"').not.toBeNull()
})
