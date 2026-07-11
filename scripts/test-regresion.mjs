// SIZO — Pruebas de regresión de MECÁNICA (Fases 0-3)
// Ejecuta 3 pruebas contra Supabase y reporta PASS/FAIL.
//   node scripts/test-regresion.mjs       (o: npm run test:mecanica)
//
// ⚠️ ALCANCE: estas pruebas usan service_role, que SALTA la RLS. Validan
// la mecánica CRUD y el cálculo de indicadores, NO la autorización por rol.
// La validación de RLS/roles vive en scripts/test-seguridad-rls.mjs (H2).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { calcularIndicadores } from '../modules/calcular-indicadores.js'
import { calcularRiesgoGtc45 } from '../modules/calcular-riesgo-gtc45.js'
import { fromRow } from '../case-convert.js'

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

  // Motor de indicadores — usa el mismo motor que el frontend
  // HHT = trab(40) × diasTrab(22) × 8 = 7.040 → IFA = 2×240.000/7.040 = 68.18
  const kpis = calcularIndicadores(fromRow(seg))
  check('Indicador plan correcto',       kpis.plan === 90,    `plan = ${kpis.plan}% (esperado 90%)`)
  check('Indicador ausentismo correcto', kpis.aus  === 2.5,   `aus = ${kpis.aus}% (esperado 2.5%)`)
  check('Indicador IFA correcto (Dec. 1072 × 240.000 HHT)', kpis.ifa === 68.18, `IFA = ${kpis.ifa} (esperado 68.18)`)

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

// ── TEST 4 — Motor GTC 45 + CRUD matriz de riesgos ──
async function test4() {
  console.log('\nTEST 4 — Motor GTC 45 y CRUD matriz de riesgos')

  // Riesgo alto conocido: ND=10 (Muy Alto) × NE=4 (Continua) = NP 40 (Muy Alto)
  // NP 40 × NC 100 (Mortal) = NR 4000 → Zona I, No aceptable
  const r1 = calcularRiesgoGtc45({ nivelDeficiencia: 10, nivelExposicion: 4, nivelConsecuencia: 100 })
  check('GTC45: NP=40 clasifica Muy Alto', r1.interpretacionProbabilidad === 'Muy Alto', `NP=${r1.nivelProbabilidad}`)
  check('GTC45: NR=4000 clasifica zona I / No aceptable',
    r1.nivelRiesgo === 4000 && r1.interpretacionRiesgo === 'I' && r1.aceptabilidad === 'No aceptable',
    `NR=${r1.nivelRiesgo} interp=${r1.interpretacionRiesgo} acept=${r1.aceptabilidad}`)

  // Riesgo bajo conocido: ND=2 (Medio) × NE=1 (Esporádica) = NP 2 (Bajo)
  // NP 2 × NC 10 (Leve) = NR 20 → Zona IV, Aceptable
  const r2 = calcularRiesgoGtc45({ nivelDeficiencia: 2, nivelExposicion: 1, nivelConsecuencia: 10 })
  check('GTC45: NR=20 clasifica zona IV / Aceptable',
    r2.nivelRiesgo === 20 && r2.interpretacionRiesgo === 'IV' && r2.aceptabilidad === 'Aceptable',
    `NR=${r2.nivelRiesgo} interp=${r2.interpretacionRiesgo} acept=${r2.aceptabilidad}`)

  const { empId, aud } = await ctx()
  const { data: creada, error: e1 } = await admin.from('matriz_riesgos').insert({
    ...aud, empresa_id: empId, proceso: 'REGRESION', actividad: 'Soldadura',
    peligro_categoria: 'fisico', peligro_descripcion: 'Radiación no ionizante',
    nivel_deficiencia: 10, nivel_exposicion: 4, nivel_consecuencia: 100,
    nivel_probabilidad: r1.nivelProbabilidad, interpretacion_probabilidad: r1.interpretacionProbabilidad,
    nivel_riesgo: r1.nivelRiesgo, interpretacion_riesgo: r1.interpretacionRiesgo, aceptabilidad: r1.aceptabilidad,
  }).select('*').single()
  check('Crear peligro en matriz de riesgos', !e1 && creada?.id, e1?.message || `id ${creada?.id}`)
  check('Nivel de riesgo calculado se persiste', creada?.nivel_riesgo === 4000, `nivel_riesgo = ${creada?.nivel_riesgo}`)

  await admin.from('matriz_riesgos').update({ activo: false, deleted_at: new Date().toISOString() }).eq('id', creada.id)
  const { data: activos } = await admin.from('matriz_riesgos').select('id').eq('id', creada.id).eq('activo', true)
  check('Soft delete excluye de listados (activo=true)', activos.length === 0, `${activos.length} fila(s) activas (esperado 0)`)

  await admin.from('matriz_riesgos').delete().eq('id', creada.id) // limpieza real
}

// ── TEST 5 — CRUD + soft delete de plantillas SGSST (EPP, documentos, actas) ──
async function test5() {
  console.log('\nTEST 5 — CRUD y soft delete: matriz_epp, entrega_epp, documentos_sst, actas')
  const { empId, aud } = await ctx()

  const casos = [
    { tabla: 'matriz_epp', datos: { cargo: 'Soldador', epp_requerido: 'Careta de soldar', zona_cuerpo: 'ojos_cara' } },
    { tabla: 'entrega_epp', datos: { trabajador: 'REGRESION', epp_entregado: 'Casco', cantidad: 1, fecha_entrega: '2099-01-01' } },
    { tabla: 'documentos_sst', datos: { tipo: 'politica', nombre: 'Política SST REGRESION' } },
    { tabla: 'actas', datos: { tipo: 'copasst', fecha: '2099-01-01', asistentes: [] } },
  ]

  for (const { tabla, datos } of casos) {
    const { data: creado, error: e1 } = await admin.from(tabla).insert({ ...aud, empresa_id: empId, ...datos }).select('*').single()
    check(`Crear registro en ${tabla}`, !e1 && creado?.id, e1?.message || `id ${creado?.id}`)

    await admin.from(tabla).update({ activo: false, deleted_at: new Date().toISOString() }).eq('id', creado.id)
    const { data: activos } = await admin.from(tabla).select('id').eq('id', creado.id).eq('activo', true)
    check(`Soft delete excluye de listados en ${tabla}`, activos.length === 0, `${activos.length} fila(s) activas (esperado 0)`)

    await admin.from(tabla).delete().eq('id', creado.id) // limpieza real
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  SIZO — PRUEBAS DE REGRESIÓN')
  console.log('═══════════════════════════════════════════')
  await test1()
  await test2()
  await test3()
  await test4()
  await test5()
  console.log('\n═══════════════════════════════════════════')
  console.log(`  RESULTADO: ${pasaron} PASS · ${fallaron} FAIL`)
  console.log('═══════════════════════════════════════════')
  if (novedades.length) { console.log('\nNovedades:'); novedades.forEach(n => console.log('  - ' + n)) }
  process.exit(fallaron ? 1 : 0)
}

main().catch(err => { console.error('Error fatal:', err.message); process.exit(1) })
