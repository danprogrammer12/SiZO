// SIZO — Pruebas de regresión (Fases 0-3)
// Ejecuta 3 pruebas contra Supabase y reporta PASS/FAIL.
//   node scripts/test-regresion.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const E = {}
for (const l of env.split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.trim().startsWith('#')) E[l.slice(0, i).trim()] = l.slice(i + 1).trim() }

const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon  = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY,         { auth: { persistSession: false } })

let pasaron = 0, fallaron = 0
const novedades = []
function check(nombre, ok, detalle) {
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${nombre}`)
  if (detalle) console.log(`         ${detalle}`)
  ok ? pasaron++ : fallaron++
  if (!ok) novedades.push(`FALLO en "${nombre}": ${detalle}`)
}

async function ctx() {
  const { data: { users } } = await admin.auth.admin.listUsers()
  const u = users.find(x => x.email === E.SIZO_ADMIN_EMAIL.toLowerCase())
  const tid = u.app_metadata.tenant_id
  const { data: emp } = await admin.from('empresas').select('id').eq('tenant_id', tid).like('nombre', '[DEMO]%').limit(1).single()
  return { tid, uid: u.id, empId: emp.id, aud: { tenant_id: tid, creado_por: u.id, updated_by: u.id } }
}

// ── TEST 1 — Aislamiento RLS: anónimo no puede leer datos del tenant ──
async function test1() {
  console.log('\nTEST 1 — Aislamiento RLS (anónimo sin sesión)')
  const { data, error } = await anon.from('empresas').select('id').limit(5)
  // RLS debe devolver 0 filas (o error). NO debe devolver datos.
  const bloqueado = (!data || data.length === 0)
  check('Anónimo NO accede a empresas del tenant', bloqueado,
    bloqueado ? 'RLS activa — 0 filas visibles sin sesión'
              : `RIESGO: se expusieron ${data.length} filas sin autenticación`)

  // El service role (servidor) sí debe leer
  const { data: srv } = await admin.from('empresas').select('id').limit(5)
  check('Service role SÍ accede (backend)', srv && srv.length > 0,
    `${srv?.length || 0} empresas visibles con service role`)
}

// ── TEST 2 — Upsert idempotente + motor de indicadores ──
async function test2() {
  console.log('\nTEST 2 — Seguimiento: upsert idempotente + cálculo de indicadores')
  const { empId, aud } = await ctx()
  const year = 2099, mes = 1
  const id = `test_${empId}_${year}_${mes}`
  const base = { id, empresa_id: empId, year, mes, ...aud, trab: 40, dias_trab: 22, dias_aus: 22, act_prog: 10, act_ejec: 8, at_oc: 2 }

  await admin.from('seguimiento').delete().eq('id', id)
  await admin.from('seguimiento').upsert(base)
  await admin.from('seguimiento').upsert({ ...base, act_ejec: 9 }) // segundo upsert mismo ID

  const { data: filas } = await admin.from('seguimiento').select('*').eq('id', id)
  check('Upsert con ID compuesto NO duplica', filas.length === 1,
    `${filas.length} fila(s) para el ID compuesto (esperado 1)`)

  const seg = filas[0]
  check('Segundo upsert actualiza (no inserta)', seg.act_ejec === 9,
    `act_ejec = ${seg.act_ejec} (esperado 9)`)

  // Motor de indicadores (replica de la fórmula pura)
  const plan = +((seg.act_ejec / seg.act_prog) * 100).toFixed(2)   // 9/10*100 = 90
  const aus  = +((seg.dias_aus / (seg.trab * seg.dias_trab)) * 100).toFixed(2) // 22/880*100 = 2.5
  const ifa  = +((seg.at_oc / seg.trab) * 100).toFixed(2)          // 2/40*100 = 5
  check('Indicador plan correcto', plan === 90, `plan = ${plan}% (esperado 90%)`)
  check('Indicador ausentismo correcto', aus === 2.5, `aus = ${aus}% (esperado 2.5%)`)
  check('Indicador IFA correcto', ifa === 5, `IFA = ${ifa} (esperado 5)`)

  await admin.from('seguimiento').delete().eq('id', id)
}

// ── TEST 3 — Ciclo CRUD + soft delete (Fase 3) ──
async function test3() {
  console.log('\nTEST 3 — Ciclo CRUD y soft delete (acciones ACPM)')
  const { empId, aud } = await ctx()

  const { data: creada, error: e1 } = await admin.from('acciones').insert({
    ...aud, empresa_id: empId, tipo: 'correctiva', origen: 'inspeccion',
    descripcion: 'REGRESION', responsable: 'Test', fecha_limite: '2099-01-01',
    prioridad: 'alta', estado: 'abierta',
  }).select('*').single()
  check('Crear acción', !e1 && creada?.id, e1?.message || `id ${creada?.id}`)

  const { data: act, error: e2 } = await admin.from('acciones')
    .update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() }).eq('id', creada.id).select('*').single()
  check('Actualizar estado a cerrada', !e2 && act.estado === 'cerrada', e2?.message || `estado ${act?.estado}`)

  // Soft delete
  await admin.from('acciones').update({ activo: false, deleted_at: new Date().toISOString() }).eq('id', creada.id)
  const { data: activas } = await admin.from('acciones').select('id').eq('id', creada.id).eq('activo', true)
  check('Soft delete excluye de listados (activo=true)', activas.length === 0,
    `${activas.length} fila(s) activas (esperado 0)`)

  // El registro sigue existiendo para auditoría
  const { data: existe } = await admin.from('acciones').select('id, activo').eq('id', creada.id).single()
  check('Registro conservado para auditoría', existe && existe.activo === false,
    `activo = ${existe?.activo} (baja lógica, no borrado físico)`)

  await admin.from('acciones').delete().eq('id', creada.id) // limpieza real
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  SIZO — PRUEBAS DE REGRESIÓN')
  console.log('═══════════════════════════════════════════')
  await test1()
  await test2()
  await test3()
  console.log('\n═══════════════════════════════════════════')
  console.log(`  RESULTADO: ${pasaron} PASS · ${fallaron} FAIL`)
  console.log('═══════════════════════════════════════════')
  if (novedades.length) { console.log('\nNovedades:'); novedades.forEach(n => console.log('  - ' + n)) }
  process.exit(fallaron ? 1 : 0)
}

main().catch(err => { console.error('Error fatal:', err.message); process.exit(1) })
