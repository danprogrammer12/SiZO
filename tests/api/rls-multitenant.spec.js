// SIZO — Regresión: RLS multitenant por rol (CONSULTA / ASESOR)
// ─────────────────────────────────────────────────────────────────────
// El gating de rutas en el frontend es solo UX; la seguridad real vive
// en las políticas RLS de PostgreSQL, evaluadas contra app_metadata del
// JWT (tenant_id, role, empresas_ids). Ver CLAUDE.md — helpers RLS en
// 001_schema_inicial.sql: is_admin(), is_asesor(), can_read_empresa(),
// can_write_empresa().
//
// Esta suite formaliza (bajo Playwright Test) lo que scripts/test-seguridad-rls.mjs
// ya cubre como script suelto — no lo reemplaza, ambos pueden coexistir mientras
// se migra por completo a tests/.
//
// Requiere .env con credenciales Supabase reales — no hay mock de RLS.
// Efectos secundarios: usuarios `*.sizo.test` y empresas `[QA-PW RLS]` en el
// tenant del ADMIN de .env. Se limpian en afterAll pase lo que pase.

import { test, expect } from '@playwright/test'
import { adminClient, getTenantId, ensureUser, signedClient, deleteTestUser } from '../helpers/supabase-test-context.js'

const EMAIL_CONSULTA = 'qa-consulta-rls@sizo.test'
const EMAIL_ASESOR = 'qa-asesor-rls@sizo.test'
const EMP_PREFIX = '[QA-PW RLS]'

let admin, tenantId, adminUid
let empA, empB // empA asignada al ASESOR de prueba; empB ajena
let consultaUid, asesorUid
let cConsulta, cAsesor

test.beforeAll(async () => {
  admin = adminClient()
  ;({ tenantId, adminUid } = await getTenantId(admin))

  async function findOrCreateEmp(nombre) {
    const { data: existing } = await admin.from('empresas').select('id')
      .eq('tenant_id', tenantId).eq('nombre', nombre).maybeSingle()
    if (existing) return existing.id
    const { data, error } = await admin.from('empresas').insert({
      tenant_id: tenantId, nombre, ciudad: 'QA', trab: 1, activa: true,
      creado_por: adminUid, updated_by: adminUid,
    }).select('id').single()
    if (error) throw new Error(`crear empresa ${nombre}: ${error.message}`)
    return data.id
  }

  empA = await findOrCreateEmp(`${EMP_PREFIX} Empresa A`)
  empB = await findOrCreateEmp(`${EMP_PREFIX} Empresa B`)

  consultaUid = await ensureUser(admin, { email: EMAIL_CONSULTA, rol: 'CONSULTA', tenantId, empresasIds: [empA] })
  asesorUid = await ensureUser(admin, { email: EMAIL_ASESOR, rol: 'ASESOR', tenantId, empresasIds: [empA] })

  cConsulta = await signedClient(EMAIL_CONSULTA)
  cAsesor = await signedClient(EMAIL_ASESOR)
})

test.afterAll(async () => {
  for (const empId of [empA, empB].filter(Boolean)) {
    await admin.from('acciones').delete().eq('empresa_id', empId)
    await admin.from('seguimiento').delete().eq('empresa_id', empId)
    await admin.from('empresas').delete().eq('id', empId)
  }
  await deleteTestUser(admin, EMAIL_CONSULTA)
  await deleteTestUser(admin, EMAIL_ASESOR)
})

test('CONSULTA puede leer su empresa asignada', async () => {
  const { data, error } = await cConsulta.from('empresas').select('id').eq('id', empA)
  expect(error, error?.message).toBeNull()
  expect(data.length).toBe(1)
})

test('CONSULTA es bloqueado por RLS al intentar INSERT', async () => {
  const { error } = await cConsulta.from('acciones').insert({
    empresa_id: empA, tenant_id: tenantId, tipo: 'correctiva', origen: 'otro',
    descripcion: 'QA RLS', responsable: 'QA', fecha_limite: '2099-01-01',
    prioridad: 'baja', estado: 'abierta', creado_por: consultaUid, updated_by: consultaUid,
  })
  expect(error, 'CONSULTA no debería poder insertar — si esto pasa, es un hallazgo de seguridad').not.toBeNull()
})

test('CONSULTA es bloqueado por RLS al intentar UPDATE', async () => {
  // Fixture insertada por service_role (bypassa RLS) para poder probar el UPDATE.
  const { data: fixture, error: fixtureErr } = await admin.from('acciones').insert({
    empresa_id: empA, tenant_id: tenantId, tipo: 'correctiva', origen: 'otro',
    descripcion: 'QA RLS fixture', responsable: 'QA', fecha_limite: '2099-01-01',
    prioridad: 'baja', estado: 'abierta', creado_por: adminUid, updated_by: adminUid,
  }).select('id').single()
  expect(fixtureErr, fixtureErr?.message).toBeNull()

  const { error } = await cConsulta.from('acciones').update({ descripcion: 'hackeado' }).eq('id', fixture.id)
  // RLS silencia el UPDATE (0 filas afectadas) en vez de devolver error explícito
  // en algunas configuraciones de PostgREST — se valida también que el dato no cambió.
  const { data: verificado } = await admin.from('acciones').select('descripcion').eq('id', fixture.id).single()
  expect(verificado.descripcion, 'CONSULTA no debería poder modificar la fila').toBe('QA RLS fixture')
  void error // el error puede o no venir explícito; lo que importa es que no mutó el dato
})

test('ASESOR ve su empresa asignada (empA)', async () => {
  const { data, error } = await cAsesor.from('empresas').select('id').eq('id', empA)
  expect(error, error?.message).toBeNull()
  expect(data.length).toBe(1)
})

test('ASESOR NO ve una empresa ajena del mismo tenant (empB)', async () => {
  const { data, error } = await cAsesor.from('empresas').select('id').eq('id', empB)
  expect(error, error?.message).toBeNull()
  expect(data.length).toBe(0)
})

test('ASESOR puede escribir en su empresa asignada (empA)', async () => {
  const { data, error } = await cAsesor.from('acciones').insert({
    empresa_id: empA, tenant_id: tenantId, tipo: 'correctiva', origen: 'otro',
    descripcion: 'QA RLS asesor OK', responsable: 'QA', fecha_limite: '2099-01-01',
    prioridad: 'baja', estado: 'abierta', creado_por: asesorUid, updated_by: asesorUid,
  }).select('id').single()
  expect(error, error?.message).toBeNull()
  expect(data).not.toBeNull()
})

test('ASESOR es bloqueado por RLS al intentar escribir en empresa ajena (empB)', async () => {
  const { error } = await cAsesor.from('acciones').insert({
    empresa_id: empB, tenant_id: tenantId, tipo: 'correctiva', origen: 'otro',
    descripcion: 'QA RLS asesor NO', responsable: 'QA', fecha_limite: '2099-01-01',
    prioridad: 'baja', estado: 'abierta', creado_por: asesorUid, updated_by: asesorUid,
  })
  expect(error, 'ASESOR no debería poder escribir fuera de sus empresas asignadas').not.toBeNull()
})

test('casos_medicos: ASESOR no puede leer (política "solo ADMIN")', async () => {
  const { data, error } = await cAsesor.from('casos_medicos').select('id').limit(1)
  const bloqueado = (!data || data.length === 0) || !!error
  expect(bloqueado, 'ASESOR no debería ver ninguna fila de casos_medicos').toBe(true)
})

test('H3: un usuario no puede escalar su propio rol vía self-update (trigger usuarios_proteger_columnas)', async () => {
  const { error } = await cConsulta.from('usuarios').update({ rol: 'ADMIN' }).eq('id', consultaUid)
  expect(error, 'el trigger debería bloquear el cambio de columnas sensibles').not.toBeNull()
  const { data: verificado } = await admin.from('usuarios').select('rol').eq('id', consultaUid).single()
  expect(verificado.rol).toBe('CONSULTA')
})
