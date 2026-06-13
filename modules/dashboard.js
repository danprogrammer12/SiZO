// SIZO — Dashboard Ejecutivo (Fase 2)
// Vista consolidada: KPIs con semáforo, tendencia anual y alertas.
import db                 from '../db.js'
import { get, subscribe } from '../store.js'
import { calcularIndicadores, semaforo } from './indicadores.js'
import { CATALOGO, DESTACADOS, ficha }   from '../catalogo.js'
import { lineChart }      from '../components/chart.js'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const COLOR_SEM = { verde:'#22C55E', amarillo:'#F59E0B', naranja:'#FB923C', rojo:'#EF4444', neutral:'#94A3B8' }

let _unsub = []

async function render(container) {
  _unsub.forEach(fn => fn()); _unsub = []
  container.innerHTML = `<div id="dash-root"></div>`
  const pintar = () => pintar_(document.getElementById('dash-root'))
  _unsub.push(subscribe('empresa', pintar))
  _unsub.push(subscribe('periodo', pintar))
}

async function pintar_(root) {
  if (!root) return
  const empresa = get('empresa')
  const periodo = get('periodo')

  if (!empresa) {
    root.innerHTML = `
      <div class="page-header"><div>
        <h2 class="page-title">Dashboard Ejecutivo</h2>
        <p class="page-subtitle">Vista consolidada del cumplimiento SG-SST</p>
      </div></div>
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <h3 class="empty-state-title">Selecciona una empresa</h3>
        <p class="text-muted">Usa el selector de empresa en la barra superior</p>
      </div>`
    return
  }

  const { year, month } = periodo

  root.innerHTML = `
    <div class="page-header"><div>
      <h2 class="page-title">Dashboard Ejecutivo</h2>
      <p class="page-subtitle">${empresa.nombre} — ${MESES[month - 1]} ${year}</p>
    </div></div>
    <div id="dash-body">
      <div style="text-align:center;padding:var(--space-12)"><div class="spinner spinner-lg"></div></div>
    </div>`

  let meses = []
  try {
    meses = await db.list('seguimiento', { eq: { empresaId: empresa.id, year }, order: 'mes' })
  } catch (err) {
    document.getElementById('dash-body').innerHTML =
      `<div class="alert alert-danger">Error al cargar datos: ${err.message}</div>`
    return
  }

  const segMes = meses.find(m => m.mes === month)
  const kpis   = segMes ? calcularIndicadores(segMes) : null

  addStyles()
  document.getElementById('dash-body').innerHTML = `
    ${renderKpis(kpis)}
    <div class="dash-row">
      <div class="card dash-chart-card">
        <h4 class="dash-section-title">Tendencia anual ${year}</h4>
        ${meses.length ? '<canvas id="dash-chart" style="width:100%;height:280px"></canvas>'
                       : '<p class="text-muted">Sin datos registrados este año</p>'}
      </div>
      <div class="card">
        <h4 class="dash-section-title">Alertas</h4>
        <div id="dash-alertas">${renderAlertas(empresa, segMes)}</div>
      </div>
    </div>
  `

  if (meses.length) dibujarChart(meses)
}

function renderKpis(kpis) {
  if (!kpis) {
    return `<div class="alert alert-info" style="margin-bottom:var(--space-4)">
      No hay seguimiento registrado para este mes.
      <a href="#seguimiento">Registrar datos →</a></div>`
  }
  return `<div class="dash-kpis">
    ${DESTACADOS.map(key => {
      const f     = ficha(key)
      const valor = kpis[key] ?? 0
      const sem   = semaforo(valor, f.meta, f.inv)
      const color = COLOR_SEM[sem]
      const unidad = f.u === '%' ? '%' : ''
      return `
        <div class="card kpi-card" style="border-left:3px solid ${color}">
          <div class="kpi-nom">${f.nom}</div>
          <div class="kpi-val" style="color:${color}">${valor}${unidad}</div>
          <div class="kpi-meta">Meta: ${f.meta}${unidad} ${f.inv ? '(menor mejor)' : ''}</div>
        </div>`
    }).join('')}
  </div>`
}

function renderAlertas(empresa, seg) {
  const alertas = []

  if (seg) {
    if (seg.accVenc > 0)
      alertas.push(['crit', `${seg.accVenc} acción(es) vencida(s)`])
    if (seg.atOc > 0 && seg.atInv < seg.atOc)
      alertas.push(['warn', `${seg.atOc - seg.atInv} AT sin investigar`])
    if (seg.casosAb > 0)
      alertas.push(['info', `${seg.casosAb} caso(s) médico(s) abierto(s)`])
    if (seg.atMort > 0)
      alertas.push(['crit', `${seg.atMort} AT mortal(es) en el período`])
  }

  if (empresa.contratoFin) {
    const dias = Math.ceil((new Date(empresa.contratoFin) - Date.now()) / 864e5)
    if (dias >= 0 && dias <= 30)
      alertas.push(['warn', `Contrato vence en ${dias} día(s)`])
  }

  if (!alertas.length)
    return '<p class="text-muted text-sm">Sin alertas activas ✓</p>'

  const icono = { crit: '🔴', warn: '🟠', info: '🔵' }
  return alertas.map(([t, msg]) =>
    `<div class="dash-alerta"><span>${icono[t]}</span><span>${msg}</span></div>`
  ).join('')
}

function dibujarChart(meses) {
  const canvas = document.getElementById('dash-chart')
  if (!canvas) return

  const labels = meses.map(m => MESES[m.mes - 1])
  const plan = meses.map(m => m.actProg > 0 ? +((m.actEjec / m.actProg) * 100).toFixed(1) : 0)
  const aus  = meses.map(m => (m.trab * m.diasTrab) > 0 ? +((m.diasAus / (m.trab * m.diasTrab)) * 100).toFixed(1) : 0)
  const at   = meses.map(m => m.atOc || 0)

  lineChart(canvas, {
    labels,
    series: [
      { label: 'Cumplimiento plan %', data: plan, color: 'brand', fill: true },
      { label: 'Ausentismo %',        data: aus,  color: 'warning', dashed: true },
      { label: 'AT del mes',          data: at,   color: 'danger' },
    ],
    yMin: 0,
  })
}

function addStyles() {
  if (document.getElementById('dash-styles')) return
  const s = document.createElement('style')
  s.id = 'dash-styles'
  s.textContent = `
    .dash-kpis {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-4); margin-bottom: var(--space-4);
    }
    .kpi-card { padding: var(--space-4); }
    .kpi-nom { font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-2); min-height: 2.4em; }
    .kpi-val { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); line-height: 1; }
    .kpi-meta { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-2); }
    .dash-row {
      display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-4);
    }
    @media (max-width: 900px) { .dash-row { grid-template-columns: 1fr; } }
    .dash-chart-card { padding: var(--space-5); }
    .dash-section-title {
      font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary); margin-bottom: var(--space-4);
    }
    .dash-alerta {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) 0; font-size: var(--font-size-sm);
      border-bottom: 1px solid var(--color-border);
    }
    .dash-alerta:last-child { border-bottom: none; }
  `
  document.head.appendChild(s)
}

export { render }
