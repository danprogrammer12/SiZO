// ─────────────────────────────────────────────────────────────
// SIZO — Store reactivo global (sin framework)
// Estado centralizado con suscriptores por clave
// ─────────────────────────────────────────────────────────────

const state = {
  user:       null,   // Firebase Auth user + claims custom
  tenant:     null,   // { id, nombre, tipo, plan }
  empresa:    null,   // empresa seleccionada en topbar
  periodo:    null,   // { year: 2025, month: 5 } período activo
  darkMode:   false,
  sidebarCollapsed: false,
}

const listeners = {}

function get(key) {
  return state[key]
}

function set(key, value) {
  state[key] = value
  if (listeners[key]) {
    listeners[key].forEach(fn => fn(value))
  }
}

function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = []
  listeners[key].push(fn)
  // Llama inmediatamente con valor actual
  fn(state[key])
  return () => {
    listeners[key] = listeners[key].filter(f => f !== fn)
  }
}

// Inicializa dark mode desde preferencia guardada
const savedDark = localStorage.getItem('sizo_dark') === 'true'
set('darkMode', savedDark)
if (savedDark) document.documentElement.classList.add('dark')

subscribe('darkMode', dark => {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('sizo_dark', dark)
})

// Inicializa período activo al mes corriente
const now = new Date()
set('periodo', { year: now.getFullYear(), month: now.getMonth() + 1 })

export { get, set, subscribe }
