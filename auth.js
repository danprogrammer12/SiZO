import { supabase }   from './supabase.js'
import { set }        from './store.js'
import { navigate }   from './router.js'

// ─────────────────────────────────────────────────────────────
// resolverSesion — extrae datos del usuario desde app_metadata
// app_metadata es seteado por el servidor (Edge Function crear-tenant/crear-usuario)
// y viene embebido en el JWT — sin consultas adicionales a la DB.
// ─────────────────────────────────────────────────────────────
function resolverSesion(session) {
  const meta = session.user.app_metadata || {}

  if (!meta.tenant_id || !meta.role) {
    throw new Error(
      'Tu cuenta no tiene tenant asignado. ' +
      'Contacta al administrador para que ejecute la provisión inicial.'
    )
  }

  return {
    uid:      session.user.id,
    email:    session.user.email,
    nombre:   session.user.user_metadata?.nombre || session.user.email,
    tenantId: meta.tenant_id,
    rol:      meta.role,
    empresas: meta.empresas_ids || [],
  }
}

// ─────────────────────────────────────────────────────────────
// Escuchar cambios de sesión — punto de entrada de la app
// ─────────────────────────────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  if (!session) {
    set('user',   null)
    set('tenant', null)
    mostrarLogin()
    return
  }

  try {
    const sesion = resolverSesion(session)

    set('user', {
      uid:      sesion.uid,
      email:    sesion.email,
      nombre:   sesion.nombre,
      tenantId: sesion.tenantId,
      rol:      sesion.rol,
      empresas: sesion.empresas,
    })

    set('tenant', { id: sesion.tenantId })

    mostrarApp()
    navigate(window.location.hash.slice(1) || 'dashboard')

  } catch (err) {
    console.error('[auth] Error resolviendo sesión:', err.message)
    mostrarErrorSesion(err.message)
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

function mensajeError(err) {
  const msg = err.message || ''
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))        return 'Debes confirmar tu correo antes de ingresar.'
  if (msg.includes('User not found'))             return 'No existe una cuenta con ese correo.'
  if (msg.includes('too many requests'))          return 'Demasiados intentos. Espera unos minutos.'
  return 'Error al iniciar sesión. Intenta de nuevo.'
}

export { login, logout }
