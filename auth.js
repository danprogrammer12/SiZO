import { supabase }   from './supabase.js'
import { set }        from './store.js'
import { navigate }   from './router.js'

// ─────────────────────────────────────────────────────────────
// Temporizador de inactividad — 30 min totales (H13 extensión)
// 25 min sin actividad → advertencia con cuenta regresiva de 5 min
// Si no hay respuesta → cierre de sesión automático
// ─────────────────────────────────────────────────────────────
const INACTIVIDAD_MS  = 25 * 60 * 1000  // 25 min → muestra advertencia
const CUENTA_REGR_MS  =  5 * 60 * 1000  // 5 min → cierre si no responde

let timerInactividad = null
let timerCuentaRegr  = null
let intervalDisplay  = null
let modalInact       = null

function iniciarTimerInactividad() {
  clearTimeout(timerInactividad)
  timerInactividad = setTimeout(mostrarAdvertenciaInactividad, INACTIVIDAD_MS)
}

function resetearInactividad() {
  // Solo resetea si no hay advertencia activa (el usuario YA está siendo avisado)
  if (modalInact) return
  iniciarTimerInactividad()
}

function detenerTimerInactividad() {
  clearTimeout(timerInactividad)
  clearTimeout(timerCuentaRegr)
  clearInterval(intervalDisplay)
  timerInactividad = null
  timerCuentaRegr  = null
  intervalDisplay  = null
}

function mostrarAdvertenciaInactividad() {
  let segsRestantes = CUENTA_REGR_MS / 1000

  const el = document.createElement('div')
  el.id = 'modal-inactividad'
  el.style.cssText = `
    position:fixed;inset:0;background:rgb(0 0 0/.6);display:flex;
    align-items:center;justify-content:center;z-index:9999;padding:1rem`
  el.innerHTML = `
    <div style="background:var(--color-surface);border-radius:var(--radius-xl);
      box-shadow:var(--shadow-xl);padding:2rem;max-width:400px;width:100%;text-align:center">
      <div style="font-size:2rem;margin-bottom:.75rem">⏱️</div>
      <h3 style="font-size:var(--font-size-lg);font-weight:600;margin-bottom:.5rem;color:var(--color-text-primary)">
        Sesión por expirar
      </h3>
      <p style="color:var(--color-text-secondary);font-size:var(--font-size-sm);margin-bottom:1.25rem">
        Llevas 25 minutos inactivo. La sesión se cerrará en
        <strong id="inact-cuenta" style="color:var(--color-danger)">5:00</strong>.
      </p>
      <button id="inact-continuar" class="btn btn-primary" style="width:100%">
        Continuar sesión
      </button>
    </div>`

  document.body.appendChild(el)
  modalInact = el

  // Cuenta regresiva visual
  intervalDisplay = setInterval(() => {
    segsRestantes--
    const min  = String(Math.floor(segsRestantes / 60)).padStart(2, '0')
    const segs = String(segsRestantes % 60).padStart(2, '0')
    const el = document.getElementById('inact-cuenta')
    if (el) el.textContent = `${min}:${segs}`
    if (segsRestantes <= 0) clearInterval(intervalDisplay)
  }, 1000)

  // Auto-logout al cabo de 5 min
  timerCuentaRegr = setTimeout(async () => {
    cerrarModalInactividad()
    await logout()
    const errEl = document.getElementById('login-error')
    if (errEl) {
      errEl.textContent = 'Tu sesión se cerró por inactividad (30 min).'
      errEl.classList.remove('hidden')
    }
  }, CUENTA_REGR_MS)

  document.getElementById('inact-continuar').addEventListener('click', () => {
    cerrarModalInactividad()
    iniciarTimerInactividad()
  })
}

function cerrarModalInactividad() {
  clearTimeout(timerCuentaRegr)
  clearInterval(intervalDisplay)
  timerCuentaRegr = null
  intervalDisplay = null
  if (modalInact) { modalInact.remove(); modalInact = null }
}

const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

// ─────────────────────────────────────────────────────────────
// resolverSesion — extrae datos del usuario desde app_metadata
// app_metadata es seteado por el servidor (Edge Function crear-tenant/crear-usuario)
// y viene embebido en el JWT — sin consultas adicionales a la DB.
// ─────────────────────────────────────────────────────────────
function resolverSesion(session) {
  const meta = session.user.app_metadata || {}
  const esSuperadmin = meta.superadmin === true

  if (!esSuperadmin && (!meta.tenant_id || !meta.role)) {
    throw new Error(
      'Tu cuenta no tiene tenant asignado. ' +
      'Contacta al administrador para que ejecute la provisión inicial.'
    )
  }

  return {
    uid:        session.user.id,
    email:      session.user.email,
    nombre:     session.user.user_metadata?.nombre || session.user.email,
    tenantId:   meta.tenant_id || null,
    rol:        meta.role || null,
    empresas:   meta.empresas_ids || [],
    superadmin: esSuperadmin,
  }
}

// ─────────────────────────────────────────────────────────────
// Escuchar cambios de sesión — punto de entrada de la app
// ─────────────────────────────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    mostrarResetPassword()
    return
  }

  if (!session) {
    set('user',   null)
    set('tenant', null)
    mostrarLogin()
    return
  }

  try {
    const sesion = resolverSesion(session)

    set('user', {
      uid:        sesion.uid,
      email:      sesion.email,
      nombre:     sesion.nombre,
      tenantId:   sesion.tenantId,
      rol:        sesion.rol,
      empresas:   sesion.empresas,
      superadmin: sesion.superadmin,
    })

    set('tenant', { id: sesion.tenantId })

    mostrarApp()
    navigate(window.location.hash.slice(1) || 'dashboard')

    // Iniciar timer de inactividad y escuchar eventos de actividad
    EVENTOS_ACTIVIDAD.forEach(ev => window.addEventListener(ev, resetearInactividad, { passive: true }))
    iniciarTimerInactividad()

  } catch (err) {
    console.error('[auth] Error resolviendo sesión:', err.message)
    mostrarErrorSesion(err.message)
  }
})

// ─────────────────────────────────────────────────────────────
// Refresca claims al volver a la pestaña (H9 — JWT obsoleto)
// Si el admin cambió rol/empresas_ids vía script de provisión,
// el nuevo JWT se carga sin que el usuario tenga que re-loguear.
// ─────────────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    supabase.auth.refreshSession().catch(() => {})
  }
})

// ─────────────────────────────────────────────────────────────
// login / logout
// ─────────────────────────────────────────────────────────────
async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

async function logout() {
  detenerTimerInactividad()
  cerrarModalInactividad()
  EVENTOS_ACTIVIDAD.forEach(ev => window.removeEventListener(ev, resetearInactividad))
  set('user',    null)
  set('tenant',  null)
  set('empresa', null)
  await supabase.auth.signOut()
}

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────
function mostrarApp() {
  document.getElementById('auth-screen').classList.add('hidden')
  document.getElementById('app-shell').classList.remove('hidden')
}

function mostrarLogin() {
  document.getElementById('auth-screen').classList.remove('hidden')
  document.getElementById('app-shell').classList.add('hidden')

  const btn     = document.getElementById('login-btn')
  const btnText = document.getElementById('login-btn-text')
  const spinner = document.getElementById('login-btn-spinner')
  if (btn)     btn.disabled        = false
  if (btnText) btnText.textContent = 'Iniciar sesión'
  if (spinner) spinner.classList.add('hidden')

  const demoBtn     = document.getElementById('demo-btn')
  const demoBtnText = document.getElementById('demo-btn-text')
  const demoSpinner = document.getElementById('demo-btn-spinner')
  if (demoBtn)     demoBtn.disabled        = false
  if (demoBtnText) demoBtnText.textContent = 'Ver demo'
  if (demoSpinner) demoSpinner.classList.add('hidden')

  document.getElementById('login-form').classList.remove('hidden')
  document.getElementById('forgot-form').classList.add('hidden')
  document.getElementById('register-form').classList.add('hidden')
}

function mostrarErrorSesion(mensaje) {
  const errEl = document.getElementById('login-error')
  if (errEl) {
    errEl.textContent = mensaje
    errEl.classList.remove('hidden')
  }
  mostrarLogin()
  supabase.auth.signOut().catch(() => {})
}

function mostrarResetPassword() {
  document.getElementById('auth-screen').classList.remove('hidden')
  document.getElementById('app-shell').classList.add('hidden')
  document.getElementById('login-form').classList.add('hidden')
  document.getElementById('forgot-form').classList.add('hidden')
  document.getElementById('reset-form').classList.remove('hidden')
}

// ─────────────────────────────────────────────────────────────
// Formulario de login
// ─────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault()

  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const btn      = document.getElementById('login-btn')
  const btnText  = document.getElementById('login-btn-text')
  const spinner  = document.getElementById('login-btn-spinner')
  const errEl    = document.getElementById('login-error')

  errEl.classList.add('hidden')
  btn.disabled        = true
  btnText.textContent = 'Iniciando sesión...'
  spinner.classList.remove('hidden')

  try {
    await login(email, password)
    // onAuthStateChange toma el control desde aquí
  } catch (err) {
    errEl.textContent   = mensajeError(err)
    errEl.classList.remove('hidden')
    btn.disabled        = false
    btnText.textContent = 'Iniciar sesión'
    spinner.classList.add('hidden')
  }
})

// ─────────────────────────────────────────────────────────────
// Botón "Ver demo" — login automático con usuario CONSULTA
// restringido a las empresas [DEMO] del tenant de pruebas.
// ─────────────────────────────────────────────────────────────
const DEMO_EMAIL    = 'demo@sizosaas.co'
const DEMO_PASSWORD = 'DemoSIZO2026!'

document.getElementById('demo-btn').addEventListener('click', async () => {
  const btn     = document.getElementById('demo-btn')
  const btnText = document.getElementById('demo-btn-text')
  const spinner = document.getElementById('demo-btn-spinner')
  const errEl   = document.getElementById('login-error')

  errEl.classList.add('hidden')
  btn.disabled        = true
  btnText.textContent = 'Entrando a la demo...'
  spinner.classList.remove('hidden')

  try {
    await login(DEMO_EMAIL, DEMO_PASSWORD)
    // onAuthStateChange toma el control desde aquí
  } catch (err) {
    errEl.textContent   = 'No se pudo cargar la demo. Intenta de nuevo en unos minutos.'
    errEl.classList.remove('hidden')
    btn.disabled        = false
    btnText.textContent = 'Ver demo'
    spinner.classList.add('hidden')
  }
})

function mensajeError(err) {
  const msg = err.message || ''
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))        return 'Debes confirmar tu correo antes de ingresar.'
  if (msg.includes('User not found'))             return 'No existe una cuenta con ese correo.'
  if (msg.includes('too many requests'))          return 'Demasiados intentos. Espera unos minutos.'
  return 'Error al iniciar sesión. Intenta de nuevo.'
}

// ─────────────────────────────────────────────────────────────
// Flujo ¿Olvidaste tu contraseña?
// ─────────────────────────────────────────────────────────────
document.getElementById('forgot-link').addEventListener('click', () => {
  document.getElementById('login-form').classList.add('hidden')
  document.getElementById('register-form').classList.add('hidden')
  document.getElementById('forgot-form').classList.remove('hidden')
  document.getElementById('forgot-error').classList.add('hidden')
  document.getElementById('forgot-ok').classList.add('hidden')
})

document.getElementById('back-to-login').addEventListener('click', () => {
  document.getElementById('forgot-form').classList.add('hidden')
  document.getElementById('login-form').classList.remove('hidden')
})

// ─────────────────────────────────────────────────────────────
// Flujo de autoregistro — crea tenant + usuario ADMIN
// ─────────────────────────────────────────────────────────────
document.getElementById('register-link').addEventListener('click', () => {
  document.getElementById('login-form').classList.add('hidden')
  document.getElementById('register-form').classList.remove('hidden')
  document.getElementById('register-error').classList.add('hidden')
})

document.getElementById('back-to-login-from-register').addEventListener('click', () => {
  document.getElementById('register-form').classList.add('hidden')
  document.getElementById('login-form').classList.remove('hidden')
})

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault()

  const empresaNombre  = document.getElementById('register-empresa').value.trim()
  const contactoNombre = document.getElementById('register-nombre').value.trim()
  const email           = document.getElementById('register-email').value.trim()
  const password         = document.getElementById('register-password').value
  const btn     = document.getElementById('register-btn')
  const btnText = document.getElementById('register-btn-text')
  const spinner = document.getElementById('register-btn-spinner')
  const errEl   = document.getElementById('register-error')

  errEl.classList.add('hidden')

  if (password.length < 8) {
    errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'
    errEl.classList.remove('hidden')
    return
  }

  btn.disabled        = true
  btnText.textContent = 'Creando cuenta...'
  spinner.classList.remove('hidden')

  try {
    const { data, error } = await supabase.functions.invoke('registrar-tenant', {
      body: { empresaNombre, contactoNombre, email, password },
    })

    if (error) {
      // FunctionsHttpError trae el body real en error.context (Response)
      const detalle = await error.context?.json?.().catch(() => null)
      throw new Error(detalle?.error || error.message)
    }
    if (data?.error) throw new Error(data.error)

    await login(email, password)
    // onAuthStateChange toma el control desde aquí
  } catch (err) {
    errEl.textContent   = mensajeErrorRegistro(err)
    errEl.classList.remove('hidden')
    btn.disabled        = false
    btnText.textContent = 'Crear cuenta'
    spinner.classList.add('hidden')
  }
})

function mensajeErrorRegistro(err) {
  const msg = err.message || ''
  if (msg.includes('Ya existe una cuenta'))    return 'Ya existe una cuenta con ese correo.'
  if (msg.includes('inválido'))                return msg
  if (msg.includes('al menos 8 caracteres'))   return msg
  if (msg.includes('Faltan campos'))           return 'Completa todos los campos.'
  return 'No se pudo crear la cuenta. Intenta de nuevo en unos minutos.'
}

document.getElementById('forgot-form').addEventListener('submit', async e => {
  e.preventDefault()
  const email   = document.getElementById('forgot-email').value.trim()
  const btn     = document.getElementById('forgot-btn')
  const btnText = document.getElementById('forgot-btn-text')
  const spinner = document.getElementById('forgot-btn-spinner')
  const errEl   = document.getElementById('forgot-error')
  const okEl    = document.getElementById('forgot-ok')

  errEl.classList.add('hidden')
  okEl.classList.add('hidden')
  btn.disabled        = true
  btnText.textContent = 'Enviando...'
  spinner.classList.remove('hidden')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  })

  btn.disabled        = false
  btnText.textContent = 'Enviar enlace'
  spinner.classList.add('hidden')

  if (error) {
    errEl.textContent = 'No se pudo enviar el enlace. Verifica el correo e intenta de nuevo.'
    errEl.classList.remove('hidden')
  } else {
    okEl.textContent = 'Enlace enviado. Revisa tu correo (incluyendo spam).'
    okEl.classList.remove('hidden')
  }
})

// ─────────────────────────────────────────────────────────────
// Formulario de nueva contraseña (tras hacer clic en el enlace del correo)
// ─────────────────────────────────────────────────────────────
document.getElementById('reset-form').addEventListener('submit', async e => {
  e.preventDefault()
  const pwd     = document.getElementById('reset-password').value
  const pwd2    = document.getElementById('reset-password2').value
  const btn     = document.getElementById('reset-btn')
  const btnText = document.getElementById('reset-btn-text')
  const spinner = document.getElementById('reset-btn-spinner')
  const errEl   = document.getElementById('reset-error')

  errEl.classList.add('hidden')

  if (pwd !== pwd2) {
    errEl.textContent = 'Las contraseñas no coinciden.'
    errEl.classList.remove('hidden')
    return
  }
  if (pwd.length < 8) {
    errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'
    errEl.classList.remove('hidden')
    return
  }

  btn.disabled        = true
  btnText.textContent = 'Guardando...'
  spinner.classList.remove('hidden')

  const { error } = await supabase.auth.updateUser({ password: pwd })

  btn.disabled        = false
  btnText.textContent = 'Guardar nueva contraseña'
  spinner.classList.add('hidden')

  if (error) {
    errEl.textContent = 'No se pudo actualizar la contraseña. El enlace puede haber expirado.'
    errEl.classList.remove('hidden')
  } else {
    // Sesión ya activa tras updateUser — onAuthStateChange lleva al dashboard
    await supabase.auth.signOut()
    mostrarLogin()
  }
})

export { login, logout }
