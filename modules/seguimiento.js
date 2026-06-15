// SIZO — Seguimiento Mensual (Fase 2)
// Fuente única de datos operativos. Un documento por empresa/año/mes
// con ID compuesto determinístico {empresaId}_{year}_{mes}.
import db                from '../db.js'
import { get, subscribe } from '../store.js'
import toast             from '../components/toast.js'
import { esc }           from '../escape.js'
import { errorUsuario }  from '../errores.js'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Secciones del formulario — keys en camelCase (= columnas snake_case en DB)
const SECCIONES = [
  { titulo: 'Accidentalidad', campos: [
    ['trab', 'N° trabajadores'], ['atOc', 'AT ocurridos'], ['atInv', 'AT investigados (≤15 días)'],
    ['atMort', 'AT mortales'], ['diasIncap', 'Días de incapacidad'], ['diasCarg', 'Días cargados'],
    ['diasIncapAt', 'Días ausentismo por AT'], ['casosEl', 'Casos nuevos enf. laboral'],
  ]},
  { titulo: 'Ausentismo', campos: [
    ['diasAus', 'Días ausentismo total'], ['diasTrab', 'Días programados (≈22)'],
  ]},
  { titulo: 'Plan de Trabajo', campos: [
    ['actProg', 'Actividades programadas'], ['actEjec', 'Actividades ejecutadas'],
    ['ctrlDef', 'Controles IPER definidos'], ['ctrlImpl', 'Controles IPER implementados'],
  ]},
  { titulo: 'Capacitación', campos: [
    ['capProg', 'Capacitaciones programadas'], ['capEjec', 'Capacitaciones ejecutadas'], ['capAsist', 'Total asistentes'],
  ]},
  { titulo: 'Inspecciones', campos: [
    ['inspProg', 'Inspecciones programadas'], ['inspEjec', 'Inspecciones ejecutadas'],
  ]},
  { titulo: 'Evaluaciones Médicas', campos: [
    ['evMedProg', 'Eval. médicas programadas'], ['evMedEjec', 'Eval. médicas ejecutadas'],
  ]},
  { titulo: 'Seguimiento SG-SST', campos: [
    ['accGen', 'Acciones generadas'], ['accCerr', 'Acciones cerradas'], ['accVenc', 'Acciones vencidas'],
    ['casosAb', 'Casos médicos abiertos'], ['reqAplic', 'Requisitos legales aplicables'], ['reqCumpl', 'Requisitos legales cumplidos'],
    ['objDef', 'Objetivos SST definidos'], ['objCumpl', 'Objetivos SST cumplidos'],
  ]},
  { titulo: 'COPASST / Vigía', campos: [
    ['copProg', 'Reuniones programadas'], ['copEjec', 'Reuniones ejecutadas'],
  ]},
  { titulo: 'COCOLAB', campos: [
    ['colProg', 'Reuniones programadas'], ['colEjec', 'Reuniones ejecutadas'],
  ]},
  { titulo: 'Visitas del Asesor', campos: [
    ['visProg', 'Visitas programadas'], ['visEjec', 'Visitas ejecutadas'],
  ]},
  { titulo: 'Plan de Emergencias', campos: [
    ['emProg', 'Actividades programadas'], ['emEjec', 'Actividades ejecutadas'],
  ]},
]

const NUM_KEYS = SECCIONES.flatMap(s => s.campos.map(c => c[0]))

let _unsub = []

async function render(container) {
  // Limpia suscripciones previas al re-montar
  _unsub.forEach(fn => fn()); _unsub = []

  container.innerHTML = `<div id="seg-root"></div>`

  const pintar = () => pintarFormulario(document.getElementById('seg-root'))
  _unsub.push(subscribe('empresa', pintar))
  _unsub.push(subscribe('periodo', pintar))
}

async function pintarFormulario(root) {
  if (!root) return
  const empresa = get('empresa')
  const periodo = get('periodo')
  const user    = get('user')

  if (!empresa) {
    root.innerHTML = `
      <div class="page-header"><div>
        <h2 class="page-title">Seguimiento Mensual</h2>
        <p class="page-subtitle">Registro de datos operativos SG-SST por período</p>
      </div></div>
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <h3 class="empty-state-title">Selecciona una empresa</h3>
        <p class="text-muted">Usa el selector de empresa en la barra superior</p>
      </div>`
    return
  }

  const { year, month } = periodo
  const segId = `${empresa.id}_${year}_${month}`
  const soloLectura = user?.rol === 'CONSULTA'

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Seguimiento Mensual</h2>
        <p class="page-subtitle">${esc(empresa.nombre)} — ${MESES[month - 1]} ${year}</p>
      </div>
      ${soloLectura ? '' : `
        <div style="display:flex;gap:var(--space-2);align-items:center">
          <span id="seg-estado" class="badge badge-neutral">Cargando...</span>
          <button class="btn btn-primary" id="seg-guardar" disabled>Guardar</button>
        </div>`}
    </div>
    <div id="seg-form-wrap">
      <div style="text-align:center;padding:var(--space-12)"><div class="spinner spinner-lg"></div></div>
    </div>
  `

  let existente = null
  try {
    existente = await db.getById('seguimiento', segId)
  } catch (err) {
    document.getElementById('seg-form-wrap').innerHTML =
      `<div class="alert alert-danger">${errorUsuario(err, 'cargar seguimiento')}</div>`
    return
  }

  const v = k => existente?.[k] ?? (k === 'diasTrab' ? 22 : 0)

  document.getElementById('seg-form-wrap').innerHTML = `
    <form id="seg-form" ${soloLectura ? 'inert' : ''}>
      <div class="seg-grid">
        ${SECCIONES.map(sec => `
          <div class="card seg-card">
            <h4 class="seg-card-title">${sec.titulo}</h4>
            ${sec.campos.map(([k, label]) => `
              <div class="seg-field">
                <label>${label}</label>
                <input type="number" name="${k}" min="0" step="1" value="${esc(v(k))}" />
              </div>`).join('')}
          </div>`).join('')}

        <div class="card seg-card">
          <h4 class="seg-card-title">Otros</h4>
          <div class="seg-field">
            <label>Fecha último AT</label>
            <input type="date" name="fechaUltimoAt" value="${esc(existente?.fechaUltimoAt || '')}" />
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:var(--space-4)">
        <div class="seg-field">
          <label>Observaciones del asesor</label>
          <textarea name="obs" rows="3" placeholder="Notas del período...">${esc(existente?.obs || '')}</textarea>
        </div>
        ${soloLectura ? '' : `
          <label style="display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-3);cursor:pointer">
            <input type="checkbox" name="completado" ${existente?.completado ? 'checked' : ''} />
            <span>Marcar el mes como cerrado (completado)</span>
          </label>`}
      </div>
    </form>
  `

  addStyles()
  actualizarEstado(existente)

  if (!soloLectura) {
    const btn = document.getElementById('seg-guardar')
    btn.disabled = false
    btn.addEventListener('click', () => guardar(segId, empresa.id, year, month, existente))
  }
}

function actualizarEstado(doc) {
  const badge = document.getElementById('seg-estado')
  if (!badge) return
  if (!doc)            { badge.className = 'badge badge-neutral'; badge.textContent = 'Sin registrar' }
  else if (doc.completado) { badge.className = 'badge badge-success'; badge.textContent = 'Cerrado' }
  else                 { badge.className = 'badge badge-warning'; badge.textContent = 'En progreso' }
}

async function guardar(segId, empresaId, year, mes, existente) {
  const form = document.getElementById('seg-form')
  const btn  = document.getElementById('seg-guardar')
  const data = Object.fromEntries(new FormData(form).entries())

  btn.disabled = true
  btn.textContent = 'Guardando...'

  const payload = {
    id: segId, empresaId, year, mes,
    fechaUltimoAt: data.fechaUltimoAt || null,
    obs: data.obs?.trim() || '',
    completado: data.completado === 'on',
  }
  NUM_KEYS.forEach(k => { payload[k] = parseInt(data[k]) || 0 })

  // Conserva creadoPor original en updates
  if (existente?.creadoPor) payload.creadoPor = existente.creadoPor

  try {
    const guardado = await db.upsert('seguimiento', payload)
    toast.success(`Seguimiento de ${MESES[mes - 1]} guardado`)
    actualizarEstado(guardado)
    btn.disabled = false
    btn.textContent = 'Guardar'
  } catch (err) {
    toast.error(errorUsuario(err, 'guardar seguimiento'))
    btn.disabled = false
    btn.textContent = 'Guardar'
  }
}

function addStyles() {
  if (document.getElementById('seg-styles')) return
  const s = document.createElement('style')
  s.id = 'seg-styles'
  s.textContent = `
    .seg-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-4);
    }
    .seg-card { padding: var(--space-4); }
    .seg-card-title {
      font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: .05em;
      color: var(--color-brand); margin-bottom: var(--space-3); font-weight: var(--font-weight-semibold);
    }
    .seg-field { margin-bottom: var(--space-3); }
    .seg-field:last-child { margin-bottom: 0; }
    .seg-field label {
      display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }
    .seg-field input, .seg-field textarea {
      width: 100%; padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); color: var(--color-text-primary);
      font-size: var(--font-size-sm);
    }
    .seg-field input:focus, .seg-field textarea:focus {
      border-color: var(--color-brand); outline: none;
    }
  `
  document.head.appendChild(s)
}

export { render }
