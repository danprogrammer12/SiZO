// ─────────────────────────────────────────────────────────────
// SIZO — Escape HTML (defensa contra XSS)
// Neutraliza datos dinámicos (de la BD o del usuario) al interpolarlos
// dentro de plantillas HTML que se asignan con innerHTML.
// Regla: TODO valor proveniente de la BD o de un input debe pasar por esc().
// Las cadenas estáticas del código (labels, SVG) no lo necesitan.
// ─────────────────────────────────────────────────────────────
export function esc(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default esc
