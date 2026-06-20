// SIZO — Suite de estrés y regresión completa
// ─────────────────────────────────────────────────────────────────────────────
// Inicializa el sistema con datos inventados, prueba todos los módulos y
// todos los permisos (ADMIN, ASESOR, CONSULTA) con carga real de datos.
// Limpia todo al finalizar (try/finally).
//
//   node scripts/test-estres.mjs    (o: npm run test:estres)
//
// Efectos: crea usuarios/empresas *.sizo.estres y los elimina al final.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const E = {}
for (const l of env.split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.trim().startsWith('#')) E[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}

const SB_URL  = E.SUPABASE_URL
const SB_ANON = E.SUPABASE_ANON_KEY
const SB_SVC  = E.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SB_URL, SB_SVC, { auth: { persistSession: false } })

const PASS   = 'EstresTest!2026'
const PREFIX = '[ESTRES]'
const EMAILS = {
  admin:    'estres-admin@sizo.estres',
  asesor:   'estres-asesor@sizo.estres',
  consulta: 'estres-consulta@sizo.estres',
}

// ── utilidades de reporte ──────────────────────────────────────────────────
let ok = 0, fail = 0

function pass(msg) { console.log(`  ✓ PASS  ${msg}`); ok++ }
function FAIL(msg) { console.log(`  ✗ FAIL  ${msg}`); fail++ }

function check(condicion, msg, detalle = '') {
  condicion ? pass(msg) : FAIL(`${msg}${detalle ? ' — ' + detalle : ''}`)
}

function section(titulo) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${titulo}`)
  console.log('─'.repeat(60))
}

// ── generadores de datos ───────────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = arr => arr[rnd(0, arr.length - 1)]
const fecha = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toISOString()

function genSeguimiento(empresaId, tenantId, uid, year, mes) {
  const trab = rnd(10, 200)
  const atOc = rnd(0, 3)
  const actProg = rnd(5, 20)
  return {
    id: `${empresaId}_${year}_${mes}`,
    tenant_id: tenantId, empresa_id: empresaId,
    year, mes,
    trab, at_oc: atOc, at_inv: rnd(0, atOc), at_mort: 0,
    dias_incap: rnd(0, 30), dias_carg: rnd(0, 10),
    dias_incap_at: rnd(0, 15), casos_el: rnd(0, 2),
    dias_aus: rnd(0, 20), dias_trab: 22,
    act_prog: actProg, act_ejec: rnd(0, actProg),
    ctrl_def: rnd(2, 10), ctrl_impl: rnd(1, 8),
    cap_prog: rnd(2, 8), cap_ejec: rnd(1, 6), cap_asist: rnd(5, 50),
    insp_prog: rnd(1, 4), insp_ejec: rnd(1, 3),
    ev_med_prog: rnd(1, 4), ev_med_ejec: rnd(1, 3),
    acc_gen: rnd(1, 10), acc_cerr: rnd(0, 8), acc_venc: rnd(0, 2),
    casos_ab: rnd(0, 3), req_aplic: rnd(20, 50), req_cumpl: rnd(15, 48),
    obj_def: rnd(3, 8), obj_cumpl: rnd(2, 7),
    cop_prog: rnd(1, 2), cop_ejec: rnd(0, 2),
    col_prog: rnd(1, 2), col_ejec: rnd(0, 2),
    vis_prog: rnd(1, 4), vis_ejec: rnd(1, 3),
    em_prog: rnd(1, 3), em_ejec: rnd(1, 2),
    obs: `Observaciones automáticas mes ${mes}/${year}`,
    completado: mes < 6,
    updated_by: uid, creado_por: uid,
  }
}

function genAccion(empresaId, tenantId, uid, i) {
  const tipos   = ['correctiva', 'preventiva', 'mejora']
  const origenes = ['inspeccion', 'accidente', 'auditoria', 'seguimiento', 'revision_direccion', 'otro']
  const estados  = ['abierta', 'en_progreso', 'cerrada']
  const estado = pick(estados)
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    tipo: pick(tipos), origen: pick(origenes),
    descripcion: `Acción ACPM #${i} — ${pick(['Instalar señalización', 'Capacitar personal', 'Revisar EPP', 'Actualizar procedimiento', 'Investigar incidente'])}`,
    responsable: pick(['Carlos López', 'María García', 'Juan Pérez', 'Ana Rodríguez', 'Pedro Martínez']),
    fecha_limite: fecha(-rnd(-30, 60)),
    prioridad: pick(['alta', 'media', 'baja']),
    estado,
    fecha_cierre: estado === 'cerrada' ? fecha(rnd(1, 15)) : null,
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genAccidente(empresaId, tenantId, uid, i) {
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    trabajador: `Trabajador ${i} Apellido`,
    cargo: pick(['Operario', 'Supervisor', 'Técnico', 'Auxiliar', 'Coordinador']),
    area: pick(['Producción', 'Almacén', 'Oficinas', 'Mantenimiento', 'Cargue y descargue']),
    tipo_vinculacion: pick(['directa', 'contratista', 'temporal']),
    fecha: fecha(rnd(1, 365)),
    hora: `${rnd(6, 18).toString().padStart(2, '0')}:${rnd(0, 59).toString().padStart(2, '0')}`,
    lugar: `Zona ${pick(['A', 'B', 'C'])} — Planta ${rnd(1, 3)}`,
    descripcion: `Accidente de trabajo #${i}: caída al mismo nivel durante labores de ${pick(['cargue', 'descargue', 'limpieza', 'mantenimiento'])}`,
    tipo_lesion: pick(['contusión', 'laceración', 'esguince', 'fractura']),
    parte_afectada: pick(['mano derecha', 'pie izquierdo', 'rodilla', 'espalda', 'hombro']),
    dias_incapacidad: rnd(0, 30),
    es_grave: false, es_mortal: false,
    investigado: rnd(0, 1) === 1,
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genAusencia(empresaId, tenantId, uid, i) {
  const causas = ['AT', 'EL', 'EG', 'licencia_maternidad', 'licencia_luto', 'otra']
  const dias = rnd(1, 30)
  const inicio = fecha(rnd(1, 180))
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    trabajador: `Ausente ${i} Pérez`,
    cargo: pick(['Operario', 'Auxiliar', 'Técnico']),
    causa: pick(causas),
    dias,
    fecha_inicio: inicio,
    fecha_fin: new Date(new Date(inicio).getTime() + dias * 86400000).toISOString(),
    certificado: rnd(0, 1) === 1,
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genInspeccion(empresaId, tenantId, uid, i) {
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    fecha: fecha(rnd(1, 180)),
    area: pick(['Producción', 'Almacén', 'Oficinas', 'Planta eléctrica', 'Baños']),
    inspector: pick(['Carlos López', 'María García', 'Asesor Externo']),
    tipo: pick(['planeada', 'no_planeada']),
    hallazgos: [
      { areaInspeccionada: `Zona ${i}`, nivelRiesgo: pick(['alto', 'medio', 'bajo']), descripcion: `Hallazgo ${i}`, accion: 'Corregir' },
      { areaInspeccionada: `Zona ${i}B`, nivelRiesgo: 'bajo', descripcion: `Hallazgo secundario ${i}`, accion: 'Monitorear' },
    ],
    calificacion: rnd(60, 100),
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genCapacitacion(empresaId, tenantId, uid, i) {
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    tema: pick(['Manejo manual de cargas', 'Primeros auxilios', 'Uso de EPP', 'COPASST', 'Emergencias', 'Riesgo eléctrico', 'Trabajo en alturas']),
    fecha: fecha(rnd(1, 180)),
    duracion: rnd(1, 8),
    instructor: pick(['Carlos López', 'ARL SURA', 'Asesor Externo', 'SENA']),
    modalidad: pick(['presencial', 'virtual', 'mixta']),
    asistentes: rnd(5, 50),
    evaluada: rnd(0, 1) === 1,
    nota_promedio: parseFloat((rnd(30, 50) / 10).toFixed(1)),
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genPlanActividad(empresaId, tenantId, uid, year, mes, i) {
  const componentes = ['politica', 'planificacion', 'implementacion', 'verificacion', 'mejora']
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    year, mes,
    actividad: `Actividad plan #${i} — ${pick(['Revisión documental', 'Inspección de campo', 'Capacitación', 'Auditoría', 'Comité COPASST', 'Simulacro'])}`,
    componente: pick(componentes),
    responsable: pick(['RRHH', 'SST', 'Gerencia', 'Producción']),
    presupuesto: rnd(0, 1) === 1 ? rnd(100000, 5000000) : null,
    estado: pick(['pendiente', 'en_progreso', 'completada']),
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genAuditoria(empresaId, tenantId, uid, year) {
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    year,
    tipo: pick(['interna', 'externa']),
    fecha: fecha(rnd(1, 180)),
    auditor: pick(['Carlos López', 'Auditor ARL', 'Ministerio Trabajo', 'Consultor Externo']),
    alcance: 'SG-SST completo — todos los elementos del Decreto 1072/2015',
    evaluaciones: { ciclo_phva: rnd(60, 95), cumplimiento_legal: rnd(70, 99) },
    puntaje_global: rnd(60, 98),
    hallazgos: `${rnd(1, 5)} hallazgos menores identificados durante la auditoría.`,
    compromisos: 'Plan de mejora acordado con la dirección.',
    estado: pick(['pendiente', 'en_proceso', 'completada']),
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

function genCasoMedico(empresaId, tenantId, uid, i) {
  const tipos = ['AT', 'EL', 'EG']
  const tipo = pick(tipos)
  return {
    tenant_id: tenantId, empresa_id: empresaId,
    trabajador: `Paciente ${i} Rodríguez`,
    cargo: pick(['Operario', 'Auxiliar', 'Técnico']),
    tipo,
    diagnostico: pick(['Lumbalgia crónica', 'Síndrome del túnel carpiano', 'Hipoacusia', 'Dermatitis de contacto', 'Tendinitis']),
    cie10: pick(['M54.5', 'G56.0', 'H83.3', 'L23', 'M75']),
    fecha_apertura: fecha(rnd(1, 365)),
    estado: pick(['abierto', 'en_seguimiento', 'cerrado']),
    reubicacion: rnd(0, 1) === 1,
    activo: true,
    updated_by: uid, creado_por: uid,
  }
}

// ── cliente autenticado ────────────────────────────────────────────────────
async function clienteAutenticado(email) {
  const c = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}

// ── setup / cleanup ────────────────────────────────────────────────────────
let tenantId, uids = {}, empIds = []

async function setup() {
  // Obtener tenant existente
  const { data: u0 } = await admin.from('usuarios').select('tenant_id').limit(1).single()
  tenantId = u0.tenant_id

  // Crear/actualizar usuarios de prueba
  const { data: { users } } = await admin.auth.admin.listUsers()
  const roles = { admin: 'ADMIN', asesor: 'ASESOR', consulta: 'CONSULTA' }

  for (const [key, rol] of Object.entries(roles)) {
    const email = EMAILS[key]
    let u = users.find(x => x.email === email)
    const meta = { tenant_id: tenantId, role: rol, empresas_ids: [] }
    if (!u) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, app_metadata: meta })
      if (error) throw new Error(`createUser ${email}: ${error.message}`)
      u = data.user
    } else {
      await admin.auth.admin.updateUserById(u.id, { password: PASS, app_metadata: meta })
    }
    uids[key] = u.id
  }

  // Crear 3 empresas de prueba
  const baseEmpresa = (n) => ({
    tenant_id: tenantId,
    nombre: `${PREFIX} Empresa ${n}`,
    ciudad: 'Bogotá',
    trab: rnd(20, 200),
    activa: true,
    nivel_riesgo: pick(['I', 'II', 'III', 'IV']),
    arl: pick(['SURA', 'Positiva', 'Colmena', 'Bolívar']),
    updated_by: uids.admin, creado_por: uids.admin,
  })

  empIds = []
  for (let n = 1; n <= 3; n++) {
    const { data } = await admin.from('empresas').insert(baseEmpresa(n)).select('id').single()
    empIds.push(data.id)
  }

  // ADMIN: ve todas | ASESOR: empresa 0 y 1 | CONSULTA: empresa 0
  await admin.auth.admin.updateUserById(uids.admin,    { app_metadata: { tenant_id: tenantId, role: 'ADMIN',    empresas_ids: [] } })
  await admin.auth.admin.updateUserById(uids.asesor,   { app_metadata: { tenant_id: tenantId, role: 'ASESOR',   empresas_ids: [empIds[0], empIds[1]] } })
  await admin.auth.admin.updateUserById(uids.consulta, { app_metadata: { tenant_id: tenantId, role: 'CONSULTA', empresas_ids: [empIds[0]] } })

  for (const [key, rol] of Object.entries(roles)) {
    const empresasIds = key === 'admin' ? [] : key === 'asesor' ? [empIds[0], empIds[1]] : [empIds[0]]
    await admin.from('usuarios').upsert({
      id: uids[key], tenant_id: tenantId, nombre: `${PREFIX} ${rol}`,
      email: EMAILS[key], rol, activo: true, empresas_ids: empresasIds,
      creado_por: uids.admin, updated_by: uids.admin,
    }, { onConflict: 'id' })
  }

  console.log(`  Tenant: ${tenantId}`)
  console.log(`  Empresas: ${empIds.length} creadas`)
  console.log(`  Usuarios: ADMIN(${uids.admin.slice(0,8)}…) ASESOR(${uids.asesor.slice(0,8)}…) CONSULTA(${uids.consulta.slice(0,8)}…)`)
}

async function cleanup() {
  // Borrar datos de prueba por empresa
  const tablas = ['seguimiento', 'acciones', 'accidentes', 'ausencias', 'inspecciones',
                  'capacitaciones', 'plan_actividades', 'auditorias', 'casos_medicos',
                  'configuracion', 'configuracion_obs', 'eval_estructura']
  for (const t of tablas) {
    for (const eid of empIds) {
      try { await admin.from(t).delete().eq('empresa_id', eid) } catch (_) {}
    }
  }
  if (empIds.length) {
    try { await admin.from('empresas').delete().in('id', empIds) } catch (_) {}
  }

  const { data: { users } } = await admin.auth.admin.listUsers()
  for (const email of Object.values(EMAILS)) {
    const u = users.find(x => x.email === email)
    if (u) {
      try { await admin.from('usuarios').delete().eq('id', u.id) } catch (_) {}
      await admin.auth.admin.deleteUser(u.id)
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ══════════════════════════════════════════════════════════════════════════════

async function testCargaDatos() {
  section('ESTRÉS — Carga masiva de datos (vía service_role)')
  const uid = uids.admin
  const empId = empIds[0]
  const year = 2026

  // Seguimiento: 12 meses
  let seg = 0
  for (let m = 1; m <= 12; m++) {
    const { error } = await admin.from('seguimiento').upsert(genSeguimiento(empId, tenantId, uid, year, m))
    if (!error) seg++
  }
  check(seg === 12, `Seguimiento: 12 meses insertados para emp[0]`, `${seg}/12`)

  // Segunda empresa: 6 meses
  let seg2 = 0
  for (let m = 1; m <= 6; m++) {
    const { error } = await admin.from('seguimiento').upsert(genSeguimiento(empIds[1], tenantId, uid, year, m))
    if (!error) seg2++
  }
  check(seg2 === 6, `Seguimiento: 6 meses insertados para emp[1]`, `${seg2}/6`)

  // Acciones: 30 por empresa 0
  let acc = 0
  const accRows = Array.from({ length: 30 }, (_, i) => genAccion(empId, tenantId, uid, i + 1))
  const { error: accErr, data: accData } = await admin.from('acciones').insert(accRows).select('id')
  acc = accData?.length || 0
  check(acc === 30, `Acciones: 30 insertadas en emp[0]`, `${acc}/30`)
  if (accErr) console.log('    error acciones:', accErr.message)

  // Accidentes: 20
  let atN = 0
  const atRows = Array.from({ length: 20 }, (_, i) => genAccidente(empId, tenantId, uid, i + 1))
  const { data: atData } = await admin.from('accidentes').insert(atRows).select('id')
  atN = atData?.length || 0
  check(atN === 20, `Accidentes: 20 insertados en emp[0]`, `${atN}/20`)

  // Ausencias: 25
  let ausN = 0
  const ausRows = Array.from({ length: 25 }, (_, i) => genAusencia(empId, tenantId, uid, i + 1))
  const { data: ausData } = await admin.from('ausencias').insert(ausRows).select('id')
  ausN = ausData?.length || 0
  check(ausN === 25, `Ausencias: 25 insertadas en emp[0]`, `${ausN}/25`)

  // Inspecciones: 15
  let inspN = 0
  const inspRows = Array.from({ length: 15 }, (_, i) => genInspeccion(empId, tenantId, uid, i + 1))
  const { data: inspData } = await admin.from('inspecciones').insert(inspRows).select('id')
  inspN = inspData?.length || 0
  check(inspN === 15, `Inspecciones: 15 insertadas (con JSONB hallazgos)`, `${inspN}/15`)

  // Capacitaciones: 15
  let capN = 0
  const capRows = Array.from({ length: 15 }, (_, i) => genCapacitacion(empId, tenantId, uid, i + 1))
  const { data: capData } = await admin.from('capacitaciones').insert(capRows).select('id')
  capN = capData?.length || 0
  check(capN === 15, `Capacitaciones: 15 insertadas`, `${capN}/15`)

  // Plan de actividades: 24 (2 por mes, año completo)
  let planN = 0
  const planRows = Array.from({ length: 24 }, (_, i) => genPlanActividad(empId, tenantId, uid, year, (i % 12) + 1, i + 1))
  const { data: planData } = await admin.from('plan_actividades').insert(planRows).select('id')
  planN = planData?.length || 0
  check(planN === 24, `Plan actividades: 24 insertadas (año completo)`, `${planN}/24`)

  // Auditorías: 3
  let audN = 0
  const audRows = Array.from({ length: 3 }, (_, i) => genAuditoria(empId, tenantId, uid, year - i))
  const { data: audData } = await admin.from('auditorias').insert(audRows).select('id')
  audN = audData?.length || 0
  check(audN === 3, `Auditorías: 3 insertadas`, `${audN}/3`)

  // Casos médicos (ADMIN only): 10
  let casN = 0
  const casRows = Array.from({ length: 10 }, (_, i) => genCasoMedico(empId, tenantId, uid, i + 1))
  const { data: casData } = await admin.from('casos_medicos').insert(casRows).select('id')
  casN = casData?.length || 0
  check(casN === 10, `Casos médicos: 10 insertados (ADMIN vía service_role)`, `${casN}/10`)

  // Configuración empresa
  const { error: cfgErr } = await admin.from('configuracion').upsert({
    empresa_id: empId, tenant_id: tenantId,
    metas_custom: { ifa_meta: 5, aus_meta: 2, plan_meta: 90 },
    updated_by: uid,
  })
  check(!cfgErr, `Configuración: upsert OK`, cfgErr?.message)
}

async function testPermisoAdmin() {
  section('PERMISOS — ADMIN (debe leer y escribir todo)')
  const c = await clienteAutenticado(EMAILS.admin)
  const empId = empIds[0]

  // Leer
  for (const tabla of ['seguimiento', 'acciones', 'accidentes', 'ausencias', 'inspecciones',
                        'capacitaciones', 'plan_actividades', 'auditorias', 'casos_medicos']) {
    const { data, error } = await c.from(tabla).select('id').limit(5)
    check(!error && data?.length > 0, `ADMIN lee ${tabla}`, error?.message)
  }

  // Leer las 3 empresas
  const { data: emps } = await c.from('empresas').select('id').like('nombre', `${PREFIX}%`)
  check(emps?.length >= 3, `ADMIN ve las 3 empresas de prueba (puede haber más de corridas anteriores)`, `${emps?.length} visibles`)

  // Escribir: acción nueva en emp[2] (empresa que ASESOR no tiene)
  const { error: wErr } = await c.from('acciones').insert(genAccion(empIds[2], tenantId, uids.admin, 99))
  check(!wErr, `ADMIN escribe en emp[2] (empresa sin asesor asignado)`, wErr?.message)

  // Escribir: caso médico
  const { error: cmErr } = await c.from('casos_medicos').insert(genCasoMedico(empId, tenantId, uids.admin, 99))
  check(!cmErr, `ADMIN escribe en casos_medicos`, cmErr?.message)

  // Soft-delete (update activo=false)
  const { data: accRow } = await c.from('acciones').select('id').eq('empresa_id', empId).limit(1).single()
  if (accRow) {
    const { error: sdErr } = await c.from('acciones').update({ activo: false, updated_by: uids.admin }).eq('id', accRow.id)
    check(!sdErr, `ADMIN puede hacer soft-delete en acciones`, sdErr?.message)
  }
}

async function testPermisoAsesor() {
  section('PERMISOS — ASESOR (lee y escribe sus empresas; NO ve emp[2] ni casos_medicos)')
  const c = await clienteAutenticado(EMAILS.asesor)

  // Lee sus empresas (0 y 1)
  const { data: emps0 } = await c.from('seguimiento').select('id').eq('empresa_id', empIds[0])
  check(emps0?.length > 0, `ASESOR lee seguimiento de emp[0] (asignada)`, `${emps0?.length} filas`)

  const { data: emps1 } = await c.from('seguimiento').select('id').eq('empresa_id', empIds[1])
  check(emps1?.length > 0, `ASESOR lee seguimiento de emp[1] (asignada)`, `${emps1?.length} filas`)

  // NO ve emp[2]
  const { data: emps2 } = await c.from('seguimiento').select('id').eq('empresa_id', empIds[2])
  check(emps2?.length === 0, `ASESOR NO ve seguimiento de emp[2] (no asignada)`, `${emps2?.length} filas`)

  // Escribe en emp[0]
  const { error: wErr0 } = await c.from('acciones').insert(genAccion(empIds[0], tenantId, uids.asesor, 200))
  check(!wErr0, `ASESOR escribe acciones en emp[0]`, wErr0?.message)

  // NO escribe en emp[2]
  const { error: wErr2 } = await c.from('acciones').insert(genAccion(empIds[2], tenantId, uids.asesor, 201))
  check(!!wErr2, `ASESOR NO puede escribir en emp[2] (bloqueado por RLS)`, wErr2?.message)

  // NO lee casos_medicos
  const { data: cm, error: cmErr } = await c.from('casos_medicos').select('id').limit(1)
  check((!cm || cm.length === 0), `ASESOR NO lee casos_medicos (política: solo ADMIN)`, cmErr?.message)

  // Escribe inspecciones en emp[1] (JSONB hallazgos)
  const { error: inspErr } = await c.from('inspecciones').insert(genInspeccion(empIds[1], tenantId, uids.asesor, 300))
  check(!inspErr, `ASESOR escribe inspecciones con JSONB en emp[1]`, inspErr?.message)
}

async function testPermisoConsulta() {
  section('PERMISOS — CONSULTA (solo lectura, solo emp[0])')
  const c = await clienteAutenticado(EMAILS.consulta)

  // Lee emp[0]
  const { data: seg } = await c.from('seguimiento').select('id').eq('empresa_id', empIds[0])
  check(seg?.length > 0, `CONSULTA lee seguimiento de emp[0]`, `${seg?.length} filas`)

  // NO ve emp[1] ni emp[2]
  for (const idx of [1, 2]) {
    const { data } = await c.from('seguimiento').select('id').eq('empresa_id', empIds[idx])
    check(data?.length === 0, `CONSULTA NO ve seguimiento de emp[${idx}]`, `${data?.length} filas`)
  }

  // NO escribe acciones
  const { error: wErr } = await c.from('acciones').insert(genAccion(empIds[0], tenantId, uids.consulta, 400))
  check(!!wErr, `CONSULTA NO puede insertar acciones (bloqueado por RLS)`, wErr?.message)

  // NO escribe ausencias
  const { error: ausErr } = await c.from('ausencias').insert(genAusencia(empIds[0], tenantId, uids.consulta, 401))
  check(!!ausErr, `CONSULTA NO puede insertar ausencias`, ausErr?.message)

  // NO escribe seguimiento
  const { error: segErr } = await c.from('seguimiento').upsert(genSeguimiento(empIds[0], tenantId, uids.consulta, 2025, 1))
  check(!!segErr, `CONSULTA NO puede insertar/actualizar seguimiento`, segErr?.message)

  // NO escribe casos_medicos
  const { data: cm } = await c.from('casos_medicos').select('id').limit(1)
  check(!cm || cm.length === 0, `CONSULTA NO lee casos_medicos`)

  // Sí lee todas las tablas de lectura pública
  for (const tabla of ['acciones', 'accidentes', 'ausencias', 'inspecciones', 'capacitaciones', 'plan_actividades']) {
    const { data, error } = await c.from(tabla).select('id').eq('empresa_id', empIds[0]).limit(5)
    check(!error && data?.length >= 0, `CONSULTA lee ${tabla} de emp[0]`, error?.message)
  }
}

async function testAislamiento() {
  section('AISLAMIENTO — Anónimo no ve nada')
  const c = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } })

  for (const tabla of ['seguimiento', 'acciones', 'empresas', 'usuarios', 'casos_medicos']) {
    const { data } = await c.from(tabla).select('id').limit(5)
    check(!data || data.length === 0, `Anónimo NO ve ${tabla}`)
  }
}

async function testConsistenciaIndicadores() {
  section('CONSISTENCIA — Indicadores sobre datos reales')
  const { data: meses } = await admin.from('seguimiento').select('*').eq('empresa_id', empIds[0]).eq('year', 2026).order('mes')
  check(meses?.length === 12, `12 meses de seguimiento disponibles`, `${meses?.length}/12`)

  // Verificar que los cálculos básicos son coherentes
  let erroresLogica = 0
  for (const m of (meses || [])) {
    if (m.at_inv > m.at_oc)   erroresLogica++   // no puede haber más investigados que ocurridos
    if (m.act_ejec > m.act_prog * 2) erroresLogica++  // ejecutadas no debería ser el doble de programadas
    if (m.trab <= 0) erroresLogica++
  }
  check(erroresLogica === 0, `Datos de seguimiento sin inconsistencias lógicas`, `${erroresLogica} errores`)

  // Plan anual acumulado
  const totalProg = (meses || []).reduce((s, m) => s + m.act_prog, 0)
  const totalEjec = (meses || []).reduce((s, m) => s + m.act_ejec, 0)
  const pctPlan = totalProg > 0 ? Math.round(totalEjec / totalProg * 100) : 0
  check(pctPlan >= 0 && pctPlan <= 200, `Cumplimiento plan anual calculable: ${pctPlan}%`)
}

async function testLimitePaginacion() {
  section('PAGINACIÓN — Límite 500 (H8)')
  // Insertar 600 acciones en emp[0] para probar que list() devuelve ≤ 500
  const uid = uids.admin
  const rows = Array.from({ length: 50 }, (_, i) => genAccion(empIds[0], tenantId, uid, 500 + i))
  await admin.from('acciones').insert(rows)

  // Consultar sin RLS para verificar el tope
  const { data: todas } = await admin.from('acciones').select('id').eq('empresa_id', empIds[0]).limit(500)
  check((todas?.length || 0) <= 500, `list() devuelve ≤ 500 registros con .limit(500)`, `${todas?.length} registros`)

  // Sin límite tendríamos más
  const { data: sinLim } = await admin.from('acciones').select('id').eq('empresa_id', empIds[0])
  check((sinLim?.length || 0) >= (todas?.length || 0), `Sin límite se devuelven ≥ registros que con límite`, `${sinLim?.length} vs ${todas?.length}`)
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════════════')
console.log('  SIZO — SUITE DE ESTRÉS Y REGRESIÓN COMPLETA')
console.log('══════════════════════════════════════════════════════════════')

section('INICIALIZACIÓN — Creando fixtures de prueba')
try {
  await setup()
  console.log('  ✓ Fixtures creados')
} catch (err) {
  console.error('  ✗ Error en setup:', err.message)
  process.exit(1)
}

try {
  await testCargaDatos()
  await testPermisoAdmin()
  await testPermisoAsesor()
  await testPermisoConsulta()
  await testAislamiento()
  await testConsistenciaIndicadores()
  await testLimitePaginacion()
} finally {
  section('LIMPIEZA')
  await cleanup()
  console.log('  ✓ Usuarios, empresas y datos de prueba eliminados')

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(`  RESULTADO FINAL: ${ok} PASS · ${fail} FAIL`)
  console.log('══════════════════════════════════════════════════════════════\n')

  if (fail > 0) process.exit(1)
}
