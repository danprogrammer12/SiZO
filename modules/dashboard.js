// SIZO — Dashboard Ejecutivo
// Sin empresa seleccionada → vista consolidada multi-empresa (cartera)
// Con empresa seleccionada → vista individual con KPIs, gráfica y alertas
import db                 from '../db.js'
import { get, set, subscribe } from '../store.js'
import { calcularIndicadores, semaforo } from './indicadores.js'
import { CATALOGO, DESTACADOS, ficha }   from '../catalogo.js'
import { lineChart }      from '../components/chart.js'
import { esc }            from '../escape.js'
import { errorUsuario }   from '../errores.js'

const MESES     = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const COLOR_SEM = { verde:'#22C55E', amarillo:'#F59E0B', naranja:'#FB923C', rojo:'#EF4444', neutral:'#94A3B8' }
const LABEL_SEM = { verde:'Bien', amarillo:'Atención', naranja:'Alerta', rojo:'Crítico', neutral:'Sin datos' }

// KPIs que aparecen en la tabla consolidada
const KPI_TABLA = ['plan', 'aus', 'ifa', 'isa']

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
  addStyles()
  const empresa = get('empresa')
  empresa ? await pintarIndividual(root, empresa) : await pintarConsolidado(root)
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista consolidada — cartera de empresas
// ─────────────────────────────────────────────────────────────────────────────
async function pintarConsolidado(root) {
  const periodo  = get('periodo')
  const empresas = get('_empresas') || []
  const user     = get('user')

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Dashboard Ejecutivo</h2>
        <p class="page-subtitle">Vista consolidada — ${MESES[periodo.month - 1]} ${periodo.year}</p>
      </div>
    </div>
    <div id="dash-consolidado">
      <div style="text-align:center;padding:var(--space-12)"><div class="spinner spinner-lg"></div></div>
    </div>`

  if (empresas.length === 0) {
    document.getElementById('dash-consolidado').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <h3 class="empty-state-title">Sin empresas asignadas</h3>
        <p class="text-muted">
          ${user?.rol === 'ADMIN'
            ? 'Crea la primera empresa en el módulo <a href="#empresas">Empresas</a>.'
            : 'Solicita al administrador que te asigne empresas.'}
        </p>
      </div>`
    return
  }

  try {
    // Cargar seguimiento de todas las empresas en el mes actual en una sola query
    const [todos, usuarios] = await Promise.all([
      db.list('seguimiento', { eq: { year: periodo.year, mes: periodo.month } }),
      db.list('usuarios',    { order: 'nombre' }),
    ])

    const segMap   = Object.fromEntries(todos.map(s => [s.empresaId, s]))
    const userMap  = Object.fromEntries(usuarios.map(u => [u.id, u.nombre || u.email]))

    document.getElementById('dash-consolidado').innerHTML = renderTablaConsolidada(
      empresas, segMap, userMap, periodo
    )

    // Click en fila → seleccionar empresa en topbar
    document.querySelectorAll('.dash-row-empresa').forEach(row => {
      row.addEventListener('click', () => {
        const id  = row.dataset.id
        const emp = empresas.find(e => e.id === id)
        if (!emp) return
        set('empresa', emp)
        const sel = document.getElementById('topbar-empresa')
        if (sel) { sel.value = id }
      })
    })
  } catch (err) {
    document.getElementById('dash-consolidado').innerHTML =
      `<div class="alert alert-danger">${errorUsuario(err, 'cargar dashboard consolidado')}</div>`
  }
}

function renderTablaConsolidada(empresas, segMap, userMap, periodo) {
  // Resumen general — cuántas en cada estado
  const resumen = { verde: 0, amarillo: 0, naranja: 0, rojo: 0, neutral: 0 }
  const filas = empresas.map(emp => {
    const seg  = segMap[emp.id]
    const kpis = seg ? calcularIndicadores(seg) : null
    const sem  = kpis ? semaforoGeneral(kpis) : 'neutral'
    resumen[sem]++
    return { emp, seg, kpis, sem }
  })

  const resumenHtml = `
    <div class="dash-resumen">
      ${Object.entries(resumen).filter(([,v]) => v > 0).map(([s, v]) => `
        <div class="dash-resumen-pill" style="border-color:${COLOR_SEM[s]};color:${COLOR_SEM[s]}">
          <span style="font-weight:700">${v}</span> ${LABEL_SEM[s]}
        </div>`).join('')}
      <span class="text-muted text-sm">${empresas.length} empresa${empresas.length !== 1 ? 's' : ''} · ${MESES[periodo.month-1]} ${periodo.year}</span>
    </div>`

  const thead = `
    <thead>
      <tr>
        <th>Empresa</th>
        <th>Asesor</th>
        <th>Estado</th>
        ${KPI_TABLA.map(k => `<th class="text-center" title="${ficha(k).nom}">${ficha(k).abrev || k.toUpperCase()}</th>`).join('')}
        <th class="text-center">Alertas</th>
      </tr>
    </thead>`

  const tbody = filas.map(({ emp, seg, kpis, sem }) => {
    const asesorNombre = userMap[emp.asesorId] || '—'
    const color = COLOR_SEM[sem]
    const label = LABEL_SEM[sem]

    const kpiCeldas = KPI_TABLA.map(key => {
      if (!kpis) return `<td class="text-center text-muted">—</td>`
      const f     = ficha(key)
      const valor = kpis[key] ?? 0
      const s     = semaforo(valor, f.meta, f.inv)
      const c     = COLOR_SEM[s]
      const u     = f.u === '%' ? '%' : ''
      return `<td class="text-center" style="color:${c};font-weight:600">${valor}${u}</td>`
    }).join('')

    const alertas = contarAlertas(emp, seg)
    const alertaCell = alertas > 0
      ? `<td class="text-center"><span class="badge badge-danger">${alertas}</span></td>`
      : `<td class="text-center text-muted">—</td>`

    return `
      <tr class="dash-row-empresa" data-id="${esc(emp.id)}" title="Ver dashboard de ${esc(emp.nombre)}">
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <div class="dash-dot" style="background:${color}"></div>
            <span style="font-weight:500">${esc(emp.nombre)}</span>
          </div>
        </td>
        <td class="text-sm text-muted">${esc(asesorNombre)}</td>
        <td>
          <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40">
            ${label}
          </span>
        </td>
        ${kpiCeldas}
        ${alertaCell}
      </tr>`
  }).join('')

  return `
    ${resumenHtml}
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrapper">
        <table class="data-table dash-tabla-cartera">
          ${thead}
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-muted" style="margin-top:var(--space-2)">
      Haz clic en una empresa para ver su dashboard detallado.
    </p>`
}

function semaforoGeneral(kpis) {
  // Semáforo agregado: el peor de IFA, ISA y plan
  const checks = [
    semaforo(kpis.ifa,  ficha('ifa').meta,  true),
    semaforo(kpis.isa,  ficha('isa').meta,  true),
    semaforo(kpis.plan, ficha('plan').meta, false),
  ]
  const orden = ['rojo', 'naranja', 'amarillo', 'verde', 'neutral']
  return orden.find(s => checks.includes(s)) || 'neutral'
}

function contarAlertas(empresa, seg) {
  let n = 0
  if (seg) {
    if (seg.accVenc > 0) n++
    if (seg.atOc > 0 && seg.atInv < seg.atOc) n++
    if (seg.atMort > 0) n++
  }
  if (empresa.contratoFin) {
    const dias = Math.ceil((new Date(empresa.contratoFin) - Date.now()) / 864e5)
    if (dias >= 0 && dias <= 30) n++
  }
  return n
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista individual — empresa seleccionada
// ─────────────────────────────────────────────────────────────────────────────
async function pintarIndividual(root, empresa) {
  const { year, month } = get('periodo')

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Dashboard Ejecutivo</h2>
        <p class="page-subtitle">${esc(empresa.nombre)} — ${MESES[month - 1]} ${year}</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-vista-general">← Vista general</button>
    </div>
    <div id="dash-body">
      <div style="text-align:center;padding:var(--space-12)"><div class="spinner spinner-lg"></div></div>
    </div>`

  document.getElementById('btn-vista-general').addEventListener('click', () => {
    set('empresa', null)
    const sel = document.getElementById('topbar-empresa')
    if (sel) sel.value = ''
  })

  let meses = []
  try {
    meses = await db.list('seguimiento', { eq: { empresaId: empresa.id, year }, order: 'mes' })
  } catch (err) {
    document.getElementById('dash-body').innerHTML =
      `<div class="alert alert-danger">${errorUsuario(err, 'cargar dashboard')}</div>`
    return
  }

  const segMes = meses.find(m => m.mes === month)
  const kpis   = segMes ? calcularIndicadores(segMes) : null

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
    if (seg.accVenc > 0)  alertas.push(['crit', `${seg.accVenc} acción(es) vencida(s)`])
    if (seg.atOc > 0 && seg.atInv < seg.atOc)
      alertas.push(['warn', `${seg.atOc - seg.atInv} AT sin investigar`])
    if (seg.casosAb > 0) alertas.push(['info', `${seg.casosAb} caso(s) médico(s) abierto(s)`])
    if (seg.atMort > 0)  alertas.push(['crit', `${seg.atMort} AT mortal(es) en el período`])
  }
  if (empresa.contratoFin) {
    const dias = Math.ceil((new Date(empresa.contratoFin) - Date.now()) / 864e5)
    if (dias >= 0 && dias <= 30) alertas.push(['warn', `Contrato vence en ${dias} día(s)`])
  }
  if (!alertas.length) return '<p class="text-muted text-sm">Sin alertas activas ✓</p>'
  const icono = { crit: '🔴', warn: '🟠', info: '🔵' }
  return alertas.map(([t, msg]) =>
    `<div class="dash-alerta"><span>${icono[t]}</span><span>${msg}</span></div>`
  ).join('')
}

function dibujarChart(meses) {
  const canvas = document.getElementById('dash-chart')
  if (!canvas) return
  const labels = meses.map(m => MESES[m.mes - 1])
  const plan   = meses.map(m => m.actProg > 0 ? +((m.actEjec / m.actProg) * 100).toFixed(1) : 0)
  const aus    = meses.map(m => (m.trab * m.diasTrab) > 0 ? +((m.diasAus / (m.trab * m.diasTrab)) * 100).toFixed(1) : 0)
  const at     = meses.map(m => m.atOc || 0)
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
    .kpi-nom  { font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: var(--space-2); min-height: 2.4em; }
    .kpi-val  { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); line-height: 1; }
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
    .dash-resumen {
      display: flex; align-items: center; gap: var(--space-3);
      flex-wrap: wrap; margin-bottom: var(--space-4);
    }
    .dash-resumen-pill {
      display: flex; align-items: center; gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border: 1px solid; border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
    }
    .dash-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .dash-tabla-cartera tbody tr.dash-row-empresa {
      cursor: pointer; transition: background 0.1s;
    }
    .dash-tabla-cartera tbody tr.dash-row-empresa:hover {
      background: var(--color-surface-2);
    }
  `
  document.head.appendChild(s)
}

export { render }
