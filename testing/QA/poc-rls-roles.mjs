// SIZO — PoC H2/H3 (evidencia original de la auditoría)
// ─────────────────────────────────────────────────────────────────────
// NOTA: la versión OFICIAL y mantenida de esta suite (con limpieza
// automática y códigos de salida) vive en scripts/test-seguridad-rls.mjs
// — úsala vía `npm run test:seguridad`. Este archivo se conserva como la
// evidencia que demostró H2/H3 durante la auditoría.
// ─────────────────────────────────────────────────────────────────────
// A diferencia de scripts/test-regresion.mjs (que usa service_role y SALTA
// la RLS), esta suite inicia sesión REAL como CONSULTA y ASESOR con el
// cliente anon y verifica que la RLS bloquea lo prohibido.
//
//   node testing/QA/poc-rls-roles.mjs
//
// ⚠️ EFECTOS SECUNDARIOS sobre el proyecto Supabase real:
//   - Crea (o reutiliza) 2 usuarios de prueba en Auth: consulta@sizo.test, asesor@sizo.test
//   - Crea 2 empresas [QA-RLS] para probar aislamiento ASESOR↔empresa
//   - Al final intenta limpiar. Revisar Auth → Users si algo queda.
//
// Convención: cada "check" indica el resultado ESPERADO. Hoy se espera que
// H3 (self-update de usuarios) salga ⚠️ VULNERABLE — es el hallazgo a corregir.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
const E = {}
for (const l of env.split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) E[l.slice(0, i).trim()] = l.slice(i + 1).trim() }

const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PASS = 'QaRls!2026'

let ok = 0, bad = 0
function check(nombre, aprueba, detalle) {
  console.log(`  ${aprueba ? '✓ PASS' : '✗ FAIL'}  ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  aprueba ? ok++ : bad++
}

// Crea un usuario Auth con app_metadata y su fila en usuarios; devuelve uid
async function ensureUser(email, rol, tenantId, empresasIds) {
  const { data: { users } } = await admin.auth.admin.listUsers()
  let u = users.find(x => x.email === email)
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASS, email_confirm: true,
      app_metadata: { tenant_id: tenantId, role: rol, empresas_ids: empresasIds },
    })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    u = data.user
  } else {
    await admin.auth.admin.updateUserById(u.id, {
      password: PASS,
      app_metadata: { tenant_id: tenantId, role: rol, empresas_ids: empresasIds },
    })
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

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  SIZO — SUITE RLS AUTENTICADA (PoC H2/H3)')
  console.log('═══════════════════════════════════════════════════')

  // Contexto: tenant del ADMIN + 2 empresas QA
  const { data: { users } } = await admin.auth.admin.listUsers()
  const adminU = users.find(x => x.email === E.SIZO_ADMIN_EMAIL.toLowerCase())
  const tid = adminU.app_metadata.tenant_id
  const aud = { tenant_id: tid, creado_por: adminU.id, updated_by: adminU.id }

  const mkEmp = async nombre => {
    const { data } = await admin.from('empresas')
      .upsert({ ...aud, nombre, ciudad: 'QA', trab: 10, activa: true }, { onConflict: 'id' })
      .select('id').single()
    return data.id
  }
  // upsert sin id genera nuevas; para idempotencia buscamos por nombre
  const findOrCreate = async nombre => {
    const { data: ex } = await admin.from('empresas').select('id').eq('tenant_id', tid).eq('nombre', nombre).maybeSingle()
    if (ex) return ex.id
    const { data } = await admin.from('empresas').insert({ ...aud, nombre, ciudad: 'QA', trab: 10, activa: true }).select('id').single()
    return data.id
  }
  const empA = await findOrCreate('[QA-RLS] Empresa A')
  const empB = await findOrCreate('[QA-RLS] Empresa B')

  const consultaUid = await ensureUser('consulta@sizo.test', 'CONSULTA', tid, [])
  const asesorUid   = await ensureUser('asesor@sizo.test',   'ASESOR',   tid, [empA]) // solo empresa A

  const cCons = await signedClient('consulta@sizo.test')
  const cAse  = await signedClient('asesor@sizo.test')

  // ── TEST A — CONSULTA no puede escribir (RLS can_write_empresa) ──
  console.log('\nTEST A — CONSULTA es solo lectura')
  {
    const { error } = await cCons.from('acciones').insert({
      empresa_id: empA, tenant_id: tid, tipo: 'correctiva', origen: 'otro',
      descripcion: 'QA', responsable: 'x', fecha_limite: '2099-01-01',
      prioridad: 'baja', estado: 'abierta', creado_por: consultaUid, updated_by: consultaUid,
    })
    check('CONSULTA NO puede insertar acciones', !!error, error ? 'bloqueado por RLS' : 'RIESGO: insertó')
  }

  // ── TEST B — ASESOR solo ve/escribe SU empresa (empA), no empB ──
  console.log('\nTEST B — Aislamiento ASESOR ↔ empresa')
  {
    const { data: visibles } = await cAse.from('empresas').select('id')
    const ids = (visibles || []).map(e => e.id)
    check('ASESOR ve empA', ids.includes(empA), `${ids.length} empresa(s) visibles`)
    check('ASESOR NO ve empB (ajena)', !ids.includes(empB), ids.includes(empB) ? 'RIESGO: ve empresa ajena' : 'ok')

    const { error } = await cAse.from('acciones').insert({
      empresa_id: empB, tenant_id: tid, tipo: 'correctiva', origen: 'otro',
      descripcion: 'QA', responsable: 'x', fecha_limite: '2099-01-01',
      prioridad: 'baja', estado: 'abierta', creado_por: asesorUid, updated_by: asesorUid,
    })
    check('ASESOR NO puede escribir en empB', !!error, error ? 'bloqueado por RLS' : 'RIESGO: escribió en empresa ajena')
  }

  // ── TEST C — casos_medicos es ADMIN-only ──
  console.log('\nTEST C — casos_medicos solo ADMIN')
  {
    const { data, error } = await cAse.from('casos_medicos').select('id').limit(1)
    check('ASESOR NO lee casos_medicos', (!data || data.length === 0) || !!error,
      error ? 'bloqueado' : `${data?.length || 0} filas`)
  }

  // ── TEST D (H3) — privesc latente: self-update de usuarios sin acotar columnas ──
  console.log('\nTEST D — H3: ¿CONSULTA puede modificar su propio rol/tenant en la tabla?')
  {
    const { error } = await cCons.from('usuarios')
      .update({ rol: 'ADMIN' }).eq('id', consultaUid)
    if (error) {
      check('Tabla usuarios bloquea auto-cambio de rol', true, 'RLS/columna lo impide')
    } else {
      check('Tabla usuarios bloquea auto-cambio de rol', false,
        '⚠️ VULNERABLE (H3): el usuario cambió usuarios.rol=ADMIN en la tabla. ' +
        'Hoy NO escala porque la authz vive en el JWT, pero es escalamiento latente.')
      // revertir
      await admin.from('usuarios').update({ rol: 'CONSULTA' }).eq('id', consultaUid)
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  RESULTADO: ${ok} PASS · ${bad} FAIL`)
  console.log('  (un FAIL en TEST D confirma el hallazgo H3 a corregir)')
  console.log('═══════════════════════════════════════════════════')

  // Limpieza best-effort
  await admin.from('acciones').delete().eq('tenant_id', tid).eq('descripcion', 'QA')
  console.log('\nℹ Limpieza: empresas [QA-RLS] y usuarios *.sizo.test quedan para reuso idempotente.')
  console.log('  Bórralos manualmente en Supabase si no los necesitas.')
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
