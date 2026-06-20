// ─────────────────────────────────────────────────────────────
// SIZO — Conversión de claves camelCase ↔ snake_case
// Módulo puro (sin dependencias) para poder testearlo aislado.
//
// CONTRATO IMPORTANTE (H4):
// La conversión es INTENCIONALMENTE SHALLOW respecto al contenido de los
// valores. Solo se convierten:
//   - las claves de nivel superior de cada fila (= nombres de columna), y
//   - los elementos de un array de filas de nivel superior (resultado de list()).
// NO se recursa dentro de los valores de las columnas. Esto es deliberado:
// las columnas JSONB (inspecciones.hallazgos, auditorias.evaluaciones,
// configuracion.metas_custom, empresas.centros, ...) deben preservar sus
// claves internas TAL CUAL (round-trip verbatim). Si se hiciera recursión
// profunda, se corromperían silenciosamente esos datos JSONB.
//
// Regla práctica: lo que el frontend guarde dentro de un JSONB lo recibe
// idéntico al leerlo. Ver testing/QA/poc-jsonb-roundtrip.mjs.
// ─────────────────────────────────────────────────────────────

export const toSnake = s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
export const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

function keysTo(fn, obj) {
  // Array de nivel superior = lista de filas → convertir cada fila.
  if (Array.isArray(obj)) return obj.map(o => keysTo(fn, o))
  // Objeto de nivel superior = una fila → convertir SOLO sus claves
  // (nombres de columna). Los valores se copian sin tocar (preserva JSONB).
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const out = {}
    for (const k in obj) out[fn(k)] = obj[k]
    return out
  }
  return obj
}

export const toRow  = obj => keysTo(toSnake, obj)
export const fromRow = obj => keysTo(toCamel, obj)

export { keysTo }
