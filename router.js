// ─────────────────────────────────────────────────────────────
// SIZO — Router SPA basado en hash
// Carga módulos dinámicamente y renderiza en #view
// ─────────────────────────────────────────────────────────────
import { get } from './store.js'
import { errorUsuario } from './errores.js'

const routes = {
  'dashboard':    () => import('./modules/dashboard.js'),
  'seguimiento':  () => import('./modules/seguimiento.js'),
  'empresas':     () => import('./modules/empresas.js'),
  'usuarios':     () => import('./modules/usuarios.js'),
  'accidentes':   () => import('./modules/accidentes.js'),
  'ausentismo':   () => import('./modules/ausentismo.js'),
  'acciones':     () => import('./modules/acciones.js'),
  'inspecciones': () => import('./modules/inspecciones.js'),
  'capacitacion': () => import('./modules/capacitacion.js'),
  'plan':         () => import('./modules/plan.js'),
  'auditoria':    () => import('./modules/auditoria.js'),
  'casos':        () => import('./modules/casos.js'),
  'maestro':      () => import('./modules/maestro.js'),
  'indicadores':  () => import('./modules/indicadores.js'),
  'perfil':       () => import('./modules/perfil.js'),
}

// Control de acceso por rol — CAPA UX ÚNICAMENTE
// Redirige al dashboard si el usuario no tiene el rol requerido.
// La defensa real es la RLS de Supabase: aunque alguien manipule el hash,
// las queries no retornarán datos sin el rol correcto en el JWT.
const rolesPermitidos = {
  'casos': ['ADMIN'],
}

let moduloActual = null

async function navigate(ruta) {
  if (!ruta || !routes[ruta]) ruta = 'dashboard'

  const user = get('user')
  const restriccion = rolesPermitidos[ruta]
  if (restriccion && user && !restriccion.includes(user.rol)) {
    ruta = 'dashboard'
  }

  window.location.hash = ruta

  const view = document.getElementById('view')
  view.innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner spinner-lg"></div></div>'

  try {
    const modulo = await routes[ruta]()
    moduloActual = modulo
    if (modulo.render) {
      view.innerHTML = ''
      await modulo.render(view)
    }
  } catch (err) {
    const msg = errorUsuario(err, `cargar módulo ${ruta}`)
    view.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Error al cargar el módulo</h3>
        <p>${msg}</p>
      </div>`
  }

  // Actualiza nav activo en sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === ruta)
  })
}

// Escucha cambios de hash
window.addEventListener('hashchange', () => {
  const ruta = window.location.hash.slice(1)
  navigate(ruta)
})

export { navigate }
