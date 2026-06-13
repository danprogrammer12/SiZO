import { get, set, subscribe } from '../store.js'
import db from '../db.js'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function render() {
  const topbar = document.getElementById('topbar')
  topbar.innerHTML = `
    <button class="btn-ghost btn-icon topbar-menu-btn" id="topbar-menu" title="Menú">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <div class="topbar-empresa-selector">
      <select id="topbar-empresa" class="topbar-select" title="Empresa activa">
        <option value="">Sin empresas</option>
      </select>
    </div>

    <div class="topbar-periodo">
      <button class="btn-ghost btn-icon" id="periodo-prev" title="Mes anterior">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="topbar-periodo-label" id="periodo-label">---</span>
      <button class="btn-ghost btn-icon" id="periodo-next" title="Mes siguiente">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <div class="topbar-spacer"></div>

    <button class="btn-ghost btn-icon" id="topbar-dark" title="Alternar modo oscuro">
      <span id="dark-icon">🌙</span>
    </button>
  `

  bindEvents()
  addStyles()
  syncPeriodo()

  // Carga empresas cuando el usuario esté disponible en el store
  subscribe('user', user => {
    if (user) cargarEmpresas(user)
  })
}

function bindEvents() {
  document.getElementById('topbar-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open')
  })

  document.getElementById('topbar-dark').addEventListener('click', () => {
    set('darkMode', !get('darkMode'))
  })

  document.getElementById('topbar-empresa').addEventListener('change', e => {
    const empresas = get('_empresas') || []
    const empresa  = empresas.find(em => em.id === e.target.value) || null
    set('empresa', empresa)
  })

  document.getElementById('periodo-prev').addEventListener('click', () => cambiarPeriodo(-1))
  document.getElementById('periodo-next').addEventListener('click', () => cambiarPeriodo(1))
}

function cambiarPeriodo(delta) {
  const { year, month } = get('periodo')
  let m = month + delta
  let y = year
  if (m < 1)  { m = 12; y-- }
  if (m > 12) { m = 1;  y++ }
  set('periodo', { year: y, month: m })
}

function syncPeriodo() {
  subscribe('periodo', p => {
    const label = document.getElementById('periodo-label')
    if (label && p) label.textContent = `${MESES[p.month - 1]} ${p.year}`
  })
  subscribe('darkMode', dark => {
    const icon = document.getElementById('dark-icon')
    if (icon) icon.textContent = dark ? '☀️' : '🌙'
  })
}

async function cargarEmpresas(user) {
  if (!user?.tenantId) return
  try {
    const todas = await db.list('empresas', { eq: { activa: true }, order: 'nombre' })
    const empresas = user.rol === 'ADMIN'
      ? todas
      : todas.filter(em => (user.empresas || []).includes(em.id))

    set('_empresas', empresas)

    const select = document.getElementById('topbar-empresa')
    if (!select) return

    if (empresas.length === 0) {
      select.innerHTML = '<option value="">Sin empresas asignadas</option>'
      return
    }

    select.innerHTML = empresas.map(em =>
      `<option value="${em.id}">${em.nombre}</option>`
    ).join('')

    set('empresa', empresas[0])
  } catch (err) {
    console.error('Error cargando empresas:', err)
  }
}

function addStyles() {
  if (document.getElementById('topbar-styles')) return
  const s = document.createElement('style')
  s.id = 'topbar-styles'
  s.textContent = `
    .topbar-menu-btn { display: none; }
    @media (max-width: 768px) { .topbar-menu-btn { display: flex; } }
    .topbar-select {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-1) var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      background-color: var(--color-surface);
      cursor: pointer; max-width: 220px;
    }
    .topbar-select:focus { border-color: var(--color-brand); outline: none; }
    .topbar-periodo {
      display: flex; align-items: center; gap: var(--space-1);
      background-color: var(--color-surface-2);
      border-radius: var(--radius-full);
      padding: 2px var(--space-2);
    }
    .topbar-periodo-label {
      font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary); min-width: 70px; text-align: center;
    }
    .topbar-spacer { flex: 1; }
  `
  document.head.appendChild(s)
}

render()
export { render }
