// SIZO — Datos demo para pruebas
// Crea 2 empresas y varios meses de seguimiento para la primera.
// Idempotente: borra los datos demo previos (por marca) antes de insertar.
//
//   node scripts/seed-demo.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  for (const l of env.split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('='); if (i === -1) continue
    if (!(t.slice(0, i).trim() in process.env)) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
} catch {}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SIZO_ADMIN_EMAIL } = process.env
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const YEAR = 2026

// Datos demo de seguimiento (basados en empresa de servicios, riesgo III)
const MESES_DEMO = [
  { mes: 1, trab: 42, atOc: 1, atInv: 1, atMort: 0, diasIncap: 5, diasCarg: 0, casosEl: 0, diasAus: 12, diasTrab: 22, actProg: 8, actEjec: 7, ctrlDef: 10, ctrlImpl: 9, capProg: 3, capEjec: 3, capAsist: 38, accGen: 2, accCerr: 1, accVenc: 0, reqAplic: 15, reqCumpl: 14, objDef: 5, objCumpl: 4, copProg: 1, copEjec: 1, colProg: 1, colEjec: 1, visProg: 2, visEjec: 2, emProg: 1, emEjec: 1, inspProg: 2, inspEjec: 2, evMedProg: 8, evMedEjec: 7, casosAb: 1, fechaUltimoAt: '2026-01-15', obs: 'Inicio de plan anual. AT leve en cocina.' },
  { mes: 2, trab: 42, atOc: 0, atInv: 0, atMort: 0, diasIncap: 0, diasCarg: 0, casosEl: 0, diasAus: 8, diasTrab: 20, actProg: 8, actEjec: 7, ctrlDef: 10, ctrlImpl: 9, capProg: 3, capEjec: 2, capAsist: 28, accGen: 1, accCerr: 1, accVenc: 0, reqAplic: 15, reqCumpl: 14, objDef: 5, objCumpl: 4, copProg: 1, copEjec: 1, colProg: 1, colEjec: 0, visProg: 2, visEjec: 2, emProg: 1, emEjec: 1, inspProg: 2, inspEjec: 1, evMedProg: 0, evMedEjec: 0, casosAb: 1, obs: 'Buen mes. Se reprogramó una capacitación.' },
  { mes: 3, trab: 45, atOc: 2, atInv: 2, atMort: 0, diasIncap: 12, diasCarg: 0, casosEl: 0, diasAus: 18, diasTrab: 21, actProg: 9, actEjec: 8, ctrlDef: 10, ctrlImpl: 9, capProg: 4, capEjec: 4, capAsist: 52, accGen: 3, accCerr: 2, accVenc: 1, reqAplic: 15, reqCumpl: 13, objDef: 5, objCumpl: 4, copProg: 1, copEjec: 1, colProg: 1, colEjec: 1, visProg: 2, visEjec: 2, emProg: 1, emEjec: 1, inspProg: 3, inspEjec: 3, evMedProg: 0, evMedEjec: 0, casosAb: 2, fechaUltimoAt: '2026-03-08', obs: 'Aumento de accidentalidad en temporada alta.' },
  { mes: 4, trab: 44, atOc: 0, atInv: 0, atMort: 0, diasIncap: 0, diasCarg: 0, casosEl: 0, diasAus: 6, diasTrab: 23, actProg: 7, actEjec: 7, ctrlDef: 10, ctrlImpl: 10, capProg: 2, capEjec: 2, capAsist: 44, accGen: 2, accCerr: 2, accVenc: 0, reqAplic: 15, reqCumpl: 15, objDef: 5, objCumpl: 5, copProg: 1, copEjec: 1, colProg: 1, colEjec: 1, visProg: 2, visEjec: 2, emProg: 2, emEjec: 2, inspProg: 2, inspEjec: 2, evMedProg: 0, evMedEjec: 0, casosAb: 1, obs: 'Excelente cumplimiento. Cero AT.' },
  { mes: 5, trab: 43, atOc: 1, atInv: 0, atMort: 0, diasIncap: 3, diasCarg: 0, casosEl: 0, diasAus: 10, diasTrab: 22, actProg: 7, actEjec: 6, ctrlDef: 10, ctrlImpl: 10, capProg: 2, capEjec: 2, capAsist: 35, accGen: 1, accCerr: 1, accVenc: 0, reqAplic: 15, reqCumpl: 14, objDef: 5, objCumpl: 4, copProg: 1, copEjec: 1, colProg: 1, colEjec: 1, visProg: 1, visEjec: 1, emProg: 1, emEjec: 0, inspProg: 2, inspEjec: 2, evMedProg: 0, evMedEjec: 0, casosAb: 1, fechaUltimoAt: '2026-05-20', obs: 'AT sin investigar pendiente de cierre.' },
  { mes: 6, trab: 43, atOc: 0, atInv: 0, atMort: 0, diasIncap: 0, diasCarg: 0, casosEl: 0, diasAus: 7, diasTrab: 22, actProg: 8, actEjec: 8, ctrlDef: 10, ctrlImpl: 10, capProg: 3, capEjec: 3, capAsist: 41, accGen: 2, accCerr: 2, accVenc: 0, reqAplic: 15, reqCumpl: 15, objDef: 5, objCumpl: 5, copProg: 1, copEjec: 1, colProg: 1, colEjec: 1, visProg: 2, visEjec: 2, emProg: 1, emEjec: 1, inspProg: 2, inspEjec: 2, evMedProg: 0, evMedEjec: 0, casosAb: 0, obs: 'Mes sólido. Sin novedades.' },
]

async function main() {
  // Resolver admin + tenant
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const admin = users.find(u => u.email === SIZO_ADMIN_EMAIL?.toLowerCase())
  if (!admin) { console.error('✗ No se encontró el admin. Corre provision:admin primero.'); process.exit(1) }
  const tenantId = admin.app_metadata?.tenant_id
  if (!tenantId) { console.error('✗ El admin no tiene tenant_id. Corre provision:admin primero.'); process.exit(1) }
  const uid = admin.id

  const aud = { tenant_id: tenantId, creado_por: uid, updated_by: uid }

  // Limpiar demo previo
  await supabase.from('seguimiento').delete().eq('tenant_id', tenantId).like('id', 'demo%')
  await supabase.from('empresas').delete().eq('tenant_id', tenantId).like('nombre', '[DEMO]%')

  // Empresas demo
  const empresasDemo = [
    { ...aud, id: undefined, nombre: '[DEMO] Hotel Mar Azul S.A.S', nombre_com: 'Mar Azul', nit: '901234567-8', ciudad: 'Santa Marta', dpto: 'Magdalena', trab: 43, nivel_riesgo: 'III', clase_riesgo: 'III', arl: 'SURA', copasst: 'copasst', tipo_contrato: 'anual', contrato_inicio: '2026-01-01', contrato_fin: '2026-12-31', rep_legal: 'María Gómez', resp_sst: 'Carlos Pérez', activa: true, centros: [] },
    { ...aud, nombre: '[DEMO] Distribuciones Caribe Ltda', nombre_com: 'Caribe', nit: '900987654-3', ciudad: 'Barranquilla', dpto: 'Atlántico', trab: 78, nivel_riesgo: 'II', clase_riesgo: 'II', arl: 'Positiva', copasst: 'copasst', tipo_contrato: 'mensual', contrato_inicio: '2026-03-01', contrato_fin: '2026-07-10', rep_legal: 'Jorge Díaz', resp_sst: 'Ana Ruiz', activa: true, centros: [] },
  ].map(e => { delete e.id; return e })

  const { data: emps, error: empErr } = await supabase.from('empresas').insert(empresasDemo).select('id, nombre')
  if (empErr) { console.error('✗ Error insertando empresas:', empErr.message); process.exit(1) }
  console.log(`✓ ${emps.length} empresas demo creadas`)

  const emp1 = emps[0]

  // Seguimiento para la empresa 1
  const segRows = MESES_DEMO.map(m => {
    const { mes, ...rest } = m
    const row = { id: `demo_${emp1.id}_${YEAR}_${mes}`, empresa_id: emp1.id, year: YEAR, mes, ...aud }
    // convertir camelCase del demo a snake_case
    for (const [k, val] of Object.entries(rest))
      row[k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = val
    return row
  })

  const { error: segErr } = await supabase.from('seguimiento').upsert(segRows)
  if (segErr) { console.error('✗ Error insertando seguimiento:', segErr.message); process.exit(1) }
  console.log(`✓ ${segRows.length} meses de seguimiento creados para "${emp1.nombre}"`)

  console.log('\n✓ Seed demo completado. Recarga la app y selecciona una empresa [DEMO].')
}

main().catch(err => { console.error('✗', err.message); process.exit(1) })
