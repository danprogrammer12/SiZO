// SIZO — Motor de Indicadores (Fase 2)
// Función pura — sin I/O. Recibe datos de seguimiento y retorna los 26 KPIs calculados.
import db                 from '../db.js'
import { get, subscribe } from '../store.js'
import { CATALOGO, ficha } from '../catalogo.js'
import { esc }            from '../escape.js'
import { errorUsuario }   from '../errores.js'

/**
 * @param {object} seg  — documento de seguimiento mensual
 * @param {object} meta — metas del indicador (del catálogo o configuración custom)
 * @returns {object}    — mapa de KPIs calculados
 */
function calcularIndicadores(seg, meta = {}) {
  const trab     = seg.trab     || 1   // evitar división por cero
  const diasTrab = seg.diasTrab || 22

  const kpis = {}

  // IFA — Índice de Frecuencia de Accidentes (Dec. 1072)
  kpis.ifa = seg.atOc > 0
    ? +((seg.atOc / trab) * 100).toFixed(2)
    : 0

  // IFM — Índice de Frecuencia de Accidentes Mortales
  kpis.ifm = seg.atMort > 0
    ? +((seg.atMort / trab) * 100).toFixed(2)
    : 0

  // ISA — Índice de Severidad de Accidentes
  kpis.isa = seg.diasCarg > 0
    ? +((seg.diasCarg / trab) * 100).toFixed(2)
    : 0

  // ILI — Índice de Lesiones Incapacitantes
  kpis.ili = (kpis.ifa * kpis.isa) / 1000

  // Tasa de ausentismo general
  kpis.aus = diasTrab > 0
    ? +((seg.diasAus / (trab * diasTrab)) * 100).toFixed(2)
    : 0

  // Cumplimiento plan de trabajo
  kpis.plan = seg.actProg > 0
    ? +((seg.actEjec / seg.actProg) * 100).toFixed(2)
    : 0

  // Cumplimiento controles IPER
  kpis.iper = seg.ctrlDef > 0
    ? +((seg.ctrlImpl / seg.ctrlDef) * 100).toFixed(2)
    : 0

  // Cumplimiento capacitaciones
  kpis.cap = seg.capProg > 0
    ? +((seg.capEjec / seg.capProg) * 100).toFixed(2)
    : 0

  // Cumplimiento inspecciones
  kpis.insp = seg.inspProg > 0
    ? +((seg.inspEjec / seg.inspProg) * 100).toFixed(2)
    : 0

  // Cumplimiento evaluaciones médicas
  kpis.evMed = seg.evMedProg > 0
    ? +((seg.evMedEjec / seg.evMedProg) * 100).toFixed(2)
    : 0

  // Acciones cerradas vs generadas
  kpis.acpm = seg.accGen > 0
    ? +((seg.accCerr / seg.accGen) * 100).toFixed(2)
    : 0

  // Acciones vencidas
  kpis.accVenc = seg.accVenc || 0

  // Cumplimiento requisitos legales
  kpis.reqLeg = seg.reqAplic > 0
    ? +((seg.reqCumpl / seg.reqAplic) * 100).toFixed(2)
    : 0

  // Cumplimiento objetivos SST
  kpis.obj = seg.objDef > 0
    ? +((seg.objCumpl / seg.objDef) * 100).toFixed(2)
    : 0

  // Cumplimiento COPASST/Vigía
  kpis.cop = seg.copProg > 0
    ? +((seg.copEjec / seg.copProg) * 100).toFixed(2)
    : 0

  // Cumplimiento Cocolab
  kpis.col = seg.colProg > 0
    ? +((seg.colEjec / seg.colProg) * 100).toFixed(2)
    : 0

  // Cumplimiento visitas asesor
  kpis.vis = seg.visProg > 0
    ? +((seg.visEjec / seg.visProg) * 100).toFixed(2)
    : 0

  // Cumplimiento plan de emergencias
  kpis.em = seg.emProg > 0
    ? +((seg.emEjec / seg.emProg) * 100).toFixed(2)
    : 0

  // Casos médicos abiertos
  kpis.casosAb = seg.casosAb || 0

  // Días sin accidente
  kpis.diasSinAt = seg.fechaUltimoAt
    ? Math.floor((Date.now() - new Date(seg.fechaUltimoAt).getTime()) / 864e5)
    : null

  return kpis
}

/**
 * Semáforo de un indicador
 * @param {number} valor
 * @param {number} meta
 * @param {boolean} inv — true = menor es mejor (ifa, aus, etc.)
 */
function semaforo(valor, meta, inv = false) {
  if (valor === null || valor === undefined) return 'neutral'
  const ratio = inv
    ? (meta > 0 ? valor / meta : 0)
    : (meta > 0 ? valor / meta : 1)

  if (inv) {
    if (valor === 0)    return 'verde'
    if (ratio <= 0.5)   return 'verde'
    if (ratio <= 0.85)  return 'amarillo'
    if (ratio <= 1.0)   return 'naranja'
    return 'rojo'
  } else {
    if (ratio >= 0.85)  return 'verde'
    if (ratio >= 0.61)  return 'amarillo'
    if (ratio >= 0.41)  return 'naranja'
    return 'rojo'
  }
}

// Render del módulo Indicadores — tabla de KPIs calculados en vivo
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const COLOR_SEM = { verde:'#22C55E', amarillo:'#F59E0B', naranja:'#FB923C', rojo:'#EF4444', neutral:'#94A3B8' }
const SEM_LABEL = { verde:'Óptimo', amarillo:'Aceptable', naranja:'En riesgo', rojo:'Crítico', neutral:'—' }

let _unsub = []

async function render(container) {
  _unsub.forEach(fn => fn()); _unsub = []
  container.innerHTML = `<div id="ind-root"></div>`
  const pintar = () => pintar_(document.getElementById('ind-root'))
  _unsub.push(subscribe('empresa', pintar))
  _unsub.push(subscribe('periodo', pintar))
}

async function pintar_(root) {
  if (!root) return
  const empresa = get('empresa')
  const periodo = get('periodo')

  const header = `
    <div class="page-header"><div>
      <h2 class="page-title">Indicadores SG-SST</h2>
      <p class="page-subtitle">${empresa ? `${esc(empresa.nombre)} — ${MESES[periodo.month - 1]} ${periodo.year}` : 'Fichas técnicas y valores calculados'}</p>
    </div></div>`

  if (!empresa) {
    root.innerHTML = `${header}
      <div class="empty-state">
        <div class="empty-state-icon">📈</div>
        <h3 class="empty-state-title">Selecciona una empresa</h3>
        <p class="text-muted">Los indicadores se calculan sobre el seguimiento del período activo</p>
      </div>`
    return
  }

  root.innerHTML = `${header}<div id="ind-body"><div style="text-align:center;padding:var(--space-12)"><div class="spinner spinner-lg"></div></div></div>`

  const segId = `${empresa.id}_${periodo.year}_${periodo.month}`
  let seg = null
  try { seg = await db.getById('seguimiento', segId) } catch (err) {
    document.getElementById('ind-body').innerHTML = `<div class="alert alert-danger">${errorUsuario(err, 'cargar indicadores')}</div>`
    return
  }

  const kpis = seg ? calcularIndicadores(seg) : null

  document.getElementById('ind-body').innerHTML = `
    ${!seg ? `<div class="alert alert-info" style="margin-bottom:var(--space-4)">
      Sin seguimiento para este mes. <a href="#seguimiento">Registrar datos →</a></div>` : ''}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr><th>Indicador</th><th>Tipo</th><th>Fórmula / Normativa</th>
              <th class="text-center">Valor</th><th class="text-center">Meta</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${Object.keys(CATALOGO).map(key => {
            const f = ficha(key)
            const valor = kpis ? (kpis[key] ?? '—') : '—'
            const sem = kpis && valor !== '—' ? semaforo(valor, f.meta, f.inv) : 'neutral'
            const u = f.u === '%' ? '%' : ''
            return `
              <tr>
                <td><div style="font-weight:600">${f.nom}</div></td>
                <td><span class="badge badge-neutral">${f.tipo}</span></td>
                <td class="text-xs text-muted">${f.normativa}</td>
                <td class="text-center" style="font-weight:700;color:${COLOR_SEM[sem]}">${valor}${valor !== '—' ? u : ''}</td>
                <td class="text-center text-sm">${f.meta ?? '—'}${f.meta != null ? u : ''} ${f.inv ? '↓' : ''}</td>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--font-size-sm)">
                    <span style="width:8px;height:8px;border-radius:50%;background:${COLOR_SEM[sem]}"></span>
                    ${SEM_LABEL[sem]}
                  </span>
                </td>
              </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted" style="margin-top:var(--space-2)">↓ = menor es mejor · Metas: Dec. 1072/2015 · Res. 0312/2019</p>
  `
}

export { render, calcularIndicadores, semaforo }
