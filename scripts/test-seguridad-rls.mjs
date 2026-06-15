// SIZO — Suite de seguridad RLS (oficial)
// ─────────────────────────────────────────────────────────────────────
// Complementa a scripts/test-regresion.mjs (que prueba mecánica CRUD con
// service_role y NO valida autorización). Esta suite inicia sesión REAL
// como CONSULTA y ASESOR con el cliente anon y verifica que la RLS bloquea
// lo prohibido — es la prueba que faltaba (hallazgo H2).
//
//   node scripts/test-seguridad-rls.mjs       (o: npm run test:seguridad)
//
// Efectos secundarios: crea usuarios *.sizo.test y empresas [SEC-RLS] de
// prueba y los ELIMINA al final (try/finally), pase lo que pase.
//
// Códigos de salida: 1 si falla algún check REQUERIDO. Los "known issue"
// (hallazgos abiertos aún no corregidos, p.ej. H3) avisan pero NO rompen
// el build; convertir a requerido cuando el hallazgo se cierre.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const E = {}
for (const l of env.split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) E[l.slice(0, i).trim()] = l.slice(i + 1).trim() }

const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PASS = 'SecRls!2026'
const EMAILS = ['sec-consulta@sizo.test', 'sec-asesor@sizo.test']
const EMP_PREFIX = '[SEC-RLS]'

let req_ok = 0, req_fail = 0, known = 0
function check(nombre, ok, { required = true, detalle } = {}) {
  const etiqueta = ok ? '✓ PASS' : (required ? '✗ FAIL' : '⚠ KNOWN-ISSUE')
  console.log(`  ${etiqueta}  ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (ok) req_ok++
  else if (required) req_fail++
  else known++
}

async function ensureUser(email, rol, tenantId, empresasIds) {
  const { data: { users } } = await admin.auth.admin.listUsers()
  let u = users.find(x => x.email === email)
  const meta = { tenant_id: tenantId, role: rol, empresas_ids: empresasIds }
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, app_metadata: meta })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    u = data.user
  } else {
    await admin.auth.admin.updateUserById(u.id, { password: PASS, app_metadata: meta })
  }
  await admin.from('usuarios').upsert({
    id: u.id, tenant_id: tenantId, nombre: rol, email, rol,
    activo: true, empresas_ids: empresasIds, updated_by: u.id, creado_por: u.id,
  }, { onConflict: 'id' })
  return u.id
}

async function signedClient(email) {
  const c = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}

async function findOrCreateEmp(tid, aud, nombre) {
  const { data: ex } = await admin.from('empresas').select('id').eq('tenant_id', tid).eq('nombre', nombre).maybeSingle()
  if (ex) return ex.id
  const { data } = await admin.from('empresas').insert({ ...aud, nombre, ciudad: 'SEC', trab: 10, activa: true }).select('id').single()
  return data.id
}

async function cleanup(tid) {
  const { data: emps } = await admin.from('empresas').select('id').eq('tenant_id', tid).like('nombre', `${EMP_PREFIX}%`)
  const empIds = (emps || []).map(e => e.id)
  if (empIds.length) {
    for (const t of ['acciones', 'seguimiento']) await admin.from(t).delete().in('empresa_id', empIds)
    await admin.from('empresas').delete().in('id', empIds)
  }
  const { data: { users } } = await admin.auth.admin.listUsers()
  for (const email of EMAILS) {
    const u = users.find(x => x.email === email)
    if (u) { await admin.from('usuarios').delete().eq('id', u.id); await admin.auth.admin.deleteUser(u.id) }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  SIZO — SUITE DE SEGURIDAD RLS (autenticada por rol)')
  console.log('═══════════════════════════════════════════════════')

  const { data: { users } } = await admin.auth.admin.listUsers()
  const adminU = users.find(x => x.email === E.SIZO_ADMIN_EMAIL.toLowerCase())
  const tid = adminU.app_metadata.tenant_id
  const aud = { tenant_id: tid, creado_por: adminU.id, updated_by: adminU.id }

  try {
    const empA = await findOrCreateEmp(tid, aud, `${EMP_PREFIX} Empresa A`)
    const empB = await findOrCreateEmp(tid, aud, `${EMP_PREFIX} Empresa B`)
    const consultaUid = await ensureUser(EMAILS[0], 'CONSULTA', tid, [])
    const asesorUid   = await ensureUser(EMAILS[1], 'ASESOR',   tid, [empA])

    const anon  = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const cCons = await signedClient(EMAILS[0])
    const cAse  = await signedClient(EMAILS[1])

    console.log('\nTEST 1 — Anónimo sin sesión no lee datos del tenant')
    {
      const { data } = await anon.from('empresas').select('id').limit(5)
      check('Anónimo NO ve empresas', !data || data.length === 0, { detalle: `${data?.length || 0} filas` })
    }

    console.log('\nTEST 2 — CONSULTA es solo lectura')
    {
      const { error } = await cCons.from('acciones').insert({
        empresa_id: empA, tenant_id: tid, tipo: 'correctiva', origen: 'otro',
        descripcion: 'SEC', responsable: 'x', fecha_limite: '2099-01-01',
        prioridad: 'baja', estado: 'abierta', creado_por: consultaUid, updated_by: consultaUid,
      })
      check('CONSULTA NO puede insertar acciones', !!error, { detalle: error ? 'bloqueado por RLS' : 'RIESGO: insertó' })
    }

    console.log('\nTEST 3 — Aislamiento ASESOR ↔ empresa')
    {
      const { data: vis } = await cAse.from('empresas').select('id')
      const ids = (vis || []).map(e => e.id)
      check('ASESOR ve su empresa (empA)', ids.includes(empA), { detalle: `${ids.length} visible(s)` })
      check('ASESOR NO ve empresa ajena (empB)', !ids.includes(empB))
      const { error } = await cAse.from('acciones').insert({
        empresa_id: empB, tenant_id: tid, tipo: 'correctiva', origen: 'otro',
        descripcion: 'SEC', responsable: 'x', fecha_limite: '2099-01-01',
        prioridad: 'baja', estado: 'abierta', creado_por: asesorUid, updated_by: asesorUid,
      })
      check('ASESOR NO escribe en empresa ajena', !!error, { detalle: error ? 'bloqueado' : 'RIESGO: escribió' })
    }

    console.log('\nTEST 4 — casos_medicos solo ADMIN')
    {
      const { data, error } = await cAse.from('casos_medicos').select('id').limit(1)
      check('ASESOR NO lee casos_medicos', (!data || data.length === 0) || !!error)
    }

    console.log('\nTEST 5 — H3: usuarios NO permite self-update de columnas sensibles (trigger)')
    {
      const { error } = await cCons.from('usuarios').update({ rol: 'ADMIN' }).eq('id', consultaUid)
      check('CONSULTA NO puede cambiar su propio rol', !!error, {
        detalle: error ? 'bloqueado por trigger usuarios_proteger_columnas' : 'RIESGO: cambió su rol',
      })
      if (!error) await admin.from('usuarios').update({ rol: 'CONSULTA' }).eq('id', consultaUid)
    }
  } finally {
    await cleanup(tid)
    console.log('\nℹ Limpieza ejecutada (usuarios *.sizo.test y empresas [SEC-RLS] eliminados).')
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  REQUERIDOS: ${req_ok} PASS · ${req_fail} FAIL` + (known ? ` · ${known} known-issue` : ''))
  console.log('═══════════════════════════════════════════════════')
  process.exit(req_fail ? 1 : 0)
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
