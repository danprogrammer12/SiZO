import { get, set, subscribe } from '../store.js'
import { navigate } from '../router.js'
import { logout } from '../auth.js'
import { esc } from '../escape.js'

const NAV_ITEMS = [
  { route: 'dashboard',   label: 'Dashboard',       icon: icon_dashboard },
  { route: 'seguimiento', label: 'Seguimiento',      icon: icon_seguimiento },
  { route: 'indicadores', label: 'Indicadores',      icon: icon_indicadores },
  { divider: true, label: 'Operativo' },
  { route: 'accidentes',  label: 'Accidentalidad',   icon: icon_accidentes },
  { route: 'ausentismo',  label: 'Ausentismo',        icon: icon_ausentismo },
  { route: 'acciones',    label: 'Acciones ACPM',     icon: icon_acciones },
  { route: 'inspecciones',label: 'Inspecciones',      icon: icon_inspecciones },
  { route: 'capacitacion',label: 'Capacitación',      icon: icon_capacitacion },
  { route: 'plan',        label: 'Plan de Trabajo',   icon: icon_plan },
  { divider: true, label: 'Gestión' },
  { route: 'empresas',    label: 'Empresas',          icon: icon_empresas },
  { route: 'usuarios',    label: 'Usuarios',           icon: icon_usuarios, roles: ['ADMIN'] },
  { route: 'maestro',     label: 'Maestro',            icon: icon_maestro },
  { route: 'archivos',    label: 'Archivos',           icon: icon_archivos },
  { divider: true, label: 'Revisión' },
  { route: 'auditoria',   label: 'Auditoría',          icon: icon_auditoria },
  { route: 'casos',       label: 'Casos Médicos',      icon: icon_casos, roles: ['ADMIN'] },
  { divider: true, label: 'Plataforma', superadmin: true },
  { route: 'superadmin',  label: 'Panel Admin',        icon: icon_superadmin, superadmin: true },
]

function render() {
  const sidebar = document.getElementById('sidebar')
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <span class="sidebar-logo-text">SIZ<span class="sidebar-logo-dot">◉</span></span>
      </div>
      <button class="sidebar-collapse-btn" id="sidebar-toggle" title="Colapsar menú">
        ${icon_chevron()}
      </button>
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      ${renderNav()}
    </nav>

    <div class="sidebar-footer">
      <button class="sidebar-user-btn" id="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-avatar">?</div>
        <div class="sidebar-user-info" id="sidebar-user-info">
          <span class="sidebar-user-name">Cargando...</span>
          <span class="sidebar-user-role"></span>
        </div>
      </button>
      <button class="btn-ghost btn-icon sidebar-logout" id="sidebar-logout" title="Cerrar sesión">
        ${icon_logout()}
      </button>
    </div>
  `

  bindEvents()
  syncUser()
  addStyles()
}

function renderNav() {
  const user = get('user')
  return NAV_ITEMS.map(item => {
    if (item.superadmin && (!user || !user.superadmin)) return ''
    if (item.divider) {
      return `<div class="nav-divider">
        <span class="nav-divider-label">${item.label}</span>
      </div>`
    }
    if (item.roles && user && !item.roles.includes(user.rol)) return ''
    return `
      <button class="nav-item" data-route="${item.route}">
        <span class="nav-icon">${item.icon()}</span>
        <span class="nav-label">${item.label}</span>
      </button>`
  }).join('')
}

function bindEvents() {
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const collapsed = !get('sidebarCollapsed')
    set('sidebarCollapsed', collapsed)
    document.getElementById('sidebar').classList.toggle('collapsed', collapsed)
    document.getElementById('main-wrapper').classList.toggle('expanded', collapsed)
  })

  document.getElementById('sidebar-nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-item')
    if (!btn) return
    navigate(btn.dataset.route)
    // Cierra el drawer en mobile al navegar
    document.getElementById('sidebar').classList.remove('mobile-open')
    const overlay = document.getElementById('sidebar-overlay')
    if (overlay) overlay.classList.remove('visible')
  })

  document.getElementById('sidebar-user').addEventListener('click', () => {
    navigate('perfil')
  })

  document.getElementById('sidebar-logout').addEventListener('click', async () => {
    await logout()
  })
}

function syncUser() {
  subscribe('user', user => {
    if (!user) return

    const navEl = document.getElementById('sidebar-nav')
    if (navEl) navEl.innerHTML = renderNav()

    const avatarEl = document.getElementById('sidebar-avatar')
    const infoEl   = document.getElementById('sidebar-user-info')
    if (!avatarEl || !infoEl) return
    avatarEl.textContent = (user.nombre || user.email || '?')[0].toUpperCase()
    infoEl.innerHTML = `
      <span class="sidebar-user-name">${esc(user.nombre || user.email)}</span>
      <span class="sidebar-user-role">${esc(user.rol || '')}</span>
    `
  })
}

function addStyles() {
  if (document.getElementById('sidebar-styles')) return
  const style = document.createElement('style')
  style.id = 'sidebar-styles'
  style.textContent = `
    .sidebar-header {
      height: var(--topbar-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-4);
      border-bottom: 1px solid var(--sidebar-border);
      flex-shrink: 0;
    }
    .sidebar-logo-text {
      font-size: 1.375rem;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .sidebar-logo-dot { color: var(--color-brand); }
    .sidebar-collapse-btn {
      color: var(--sidebar-text);
      padding: 6px;
      border-radius: 6px;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }
    .sidebar-collapse-btn:hover { background: var(--sidebar-surface); color: var(--sidebar-text-active); }
    .sidebar-collapse-btn svg { transition: transform 0.3s; }
    .sidebar.collapsed .sidebar-collapse-btn svg { transform: rotate(180deg); }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--space-3) var(--space-2);
    }
    .sidebar-nav::-webkit-scrollbar { width: 4px; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: var(--sidebar-border); border-radius: 2px; }

    .nav-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      color: var(--sidebar-text);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      transition: all var(--transition-fast);
      white-space: nowrap;
      text-align: left;
    }
    .nav-item:hover { background: var(--sidebar-surface); color: var(--sidebar-text-active); }
    .nav-item.active { background: var(--color-brand); color: #fff; }

    .nav-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 20px; }
    .nav-label { overflow: hidden; transition: opacity var(--transition-slow), width var(--transition-slow); }

    .sidebar.collapsed .nav-label { opacity: 0; width: 0; }
    .sidebar.collapsed .sidebar-logo-text { opacity: 0; width: 0; overflow: hidden; }
    .sidebar.collapsed .nav-divider-label { opacity: 0; }

    .nav-divider {
      padding: var(--space-3) var(--space-3) var(--space-1);
      margin-top: var(--space-2);
    }
    .nav-divider-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--sidebar-border);
      transition: opacity var(--transition-slow);
    }

    .sidebar-footer {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3);
      border-top: 1px solid var(--sidebar-border);
      flex-shrink: 0;
    }
    .sidebar-user-btn {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2);
      border-radius: var(--radius-md);
      color: var(--sidebar-text);
      transition: all var(--transition-fast);
      overflow: hidden;
      text-align: left;
    }
    .sidebar-user-btn:hover { background: var(--sidebar-surface); }
    .sidebar-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-brand);
      color: #fff;
      font-size: var(--font-size-sm);
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sidebar-user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: opacity var(--transition-slow), width var(--transition-slow);
    }
    .sidebar.collapsed .sidebar-user-info { opacity: 0; width: 0; }
    .sidebar-user-name {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--sidebar-text-active);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sidebar-user-role {
      font-size: 10px;
      color: var(--sidebar-text);
      white-space: nowrap;
    }
    .sidebar-logout {
      color: var(--sidebar-text);
      flex-shrink: 0;
    }
    .sidebar-logout:hover { color: var(--color-danger); background: #450A0A; }
    .sidebar.collapsed .sidebar-logout { display: none; }
  `
  document.head.appendChild(style)
}

// Iconos SVG
function icon_dashboard() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' }
function icon_seguimiento() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' }
function icon_indicadores() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' }
function icon_accidentes()  { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' }
function icon_ausentismo()  { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>' }
function icon_acciones()    { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' }
function icon_inspecciones(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' }
function icon_capacitacion(){ return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' }
function icon_plan()        { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' }
function icon_empresas()    { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' }
function icon_usuarios()    { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' }
function icon_maestro()     { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M2 12h2m16 0h2M5.34 5.34L3.93 3.93M20.07 20.07l-1.41-1.41M12 2v2m0 16v2"/></svg>' }
function icon_auditoria()   { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' }
function icon_casos()       { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' }
function icon_archivos()    { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' }
function icon_superadmin()  { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' }
function icon_chevron()     { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' }
function icon_logout()      { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' }

render()

export { render }
