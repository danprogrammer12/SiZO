// SIZO — Limpieza de artefactos de poc-rls-roles.mjs
// Borra los usuarios y empresas de prueba creados por la suite RLS.
//
//   node testing/QA/poc-cleanup.mjs
//
// Usa service_role. Borra:
//   - Auth users: consulta@sizo.test, asesor@sizo.test (+ su fila en usuarios)
//   - Empresas [QA-RLS] Empresa A/B y sus filas dependientes (acciones QA)

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
const E = {}
for (const l of env.split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) E[l.slice(0, i).trim()] = l.slice(i + 1).trim() }

const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EMAILS_TEST    = ['consulta@sizo.test', 'asesor@sizo.test']
const EMPRESAS_TEST  = ['[QA-RLS] Empresa A', '[QA-RLS] Empresa B']

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  SIZO — LIMPIEZA DE ARTEFACTOS QA')
  console.log('═══════════════════════════════════════════\n')

  // 1. Empresas de prueba (y sus dependencias)
  const { data: emps } = await admin.from('empresas').select('id, nombre').in('nombre', EMPRESAS_TEST)
  const empIds = (emps || []).map(e => e.id)

  if (empIds.length) {
    // Borrar dependencias que referencian empresa_id (FK) antes de la empresa
    const tablasDep = ['acciones', 'accidentes', 'ausencias', 'inspecciones',
      'capacitaciones', 'plan_actividades', 'auditorias', 'casos_medicos',
      'seguimiento', 'configuracion', 'configuracion_obs', 'eval_estructura']
    for (const t of tablasDep) {
      const { error } = await admin.from(t).delete().in('empresa_id', empIds)
      if (error && !/does not exist/i.test(error.message)) console.log(`  ⚠ ${t}: ${error.message}`)
    }
    const { error: empErr } = await admin.from('empresas').delete().in('id', empIds)
    console.log(empErr ? `  ✗ empresas: ${empErr.message}` : `  ✓ ${empIds.length} empresa(s) [QA-RLS] eliminada(s)`)
  } else {
    console.log('  ℹ No hay empresas [QA-RLS] que borrar')
  }

  // 2. Usuarios de prueba (fila en usuarios + Auth user)
  const { data: { users } } = await admin.auth.admin.listUsers()
  for (const email of EMAILS_TEST) {
    const u = users.find(x => x.email === email)
    if (!u) { console.log(`  ℹ No existe usuario ${email}`); continue }
    await admin.from('usuarios').delete().eq('id', u.id)
    const { error } = await admin.auth.admin.deleteUser(u.id)
    console.log(error ? `  ✗ ${email}: ${error.message}` : `  ✓ Usuario ${email} eliminado`)
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  LIMPIEZA COMPLETADA')
  console.log('═══════════════════════════════════════════')
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
