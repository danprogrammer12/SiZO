// ─────────────────────────────────────────────────────────────
// SIZO — Manejo de errores hacia el usuario (H5)
// Nunca mostrar al usuario `err.message` crudo: filtra internals de
// PostgreSQL/PostgREST y puede ser vector de XSS si se interpola como HTML.
// Esta función registra el detalle técnico en consola (para depurar) y
// devuelve un mensaje genérico SEGURO (sin metacaracteres HTML), apto tanto
// para textContent como para innerHTML/toast.
// ─────────────────────────────────────────────────────────────
const MSG_GENERICO = 'No se pudo completar la operación. Intenta de nuevo o contacta al administrador.'

export function errorUsuario(err, contexto = '') {
  console.error(`[SIZO]${contexto ? ' ' + contexto : ''}:`, err)
  return MSG_GENERICO
}

export default errorUsuario
