// ─────────────────────────────────────────────────────────────
// SIZO — Capa de acceso a datos (Supabase)
// Envuelve el cliente con conversión camelCase ↔ snake_case y
// campos de auditoría automáticos. Las RLS policies del schema
// garantizan el aislamiento por tenant; aquí solo se inyectan
// tenant_id y los campos de auditoría en escrituras.
// ─────────────────────────────────────────────────────────────
import { supabase }            from './supabase.js'
import { get }                 from './store.js'
import { toSnake, toRow, fromRow } from './case-convert.js'

function ctx() {
  const user = get('user') || {}
  return { tenantId: user.tenantId, uid: user.uid }
}

const LIMITE_LISTA_DEFAULT = 500

// ── Lectura ──────────────────────────────────────────────────
async function list(table, { eq = {}, order, ascending = true, limit = LIMITE_LISTA_DEFAULT } = {}) {
  let q = supabase.from(table).select('*')
  for (const [col, val] of Object.entries(eq)) q = q.eq(toSnake(col), val)
  if (order) q = q.order(toSnake(order), { ascending })
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return fromRow(data)
}

async function getById(table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? fromRow(data) : null
}

// ── Escritura ────────────────────────────────────────────────
async function insert(table, data) {
  const { tenantId, uid } = ctx()
  const row = toRow({
    ...data,
    tenantId,
    creadoPor: uid,
    updatedBy: uid,
  })
  const { data: out, error } = await supabase.from(table).insert(row).select('*').single()
  if (error) throw new Error(error.message)
  return fromRow(out)
}

async function update(table, id, data) {
  const { uid } = ctx()
  const row = toRow({ ...data, updatedBy: uid, updatedAt: new Date().toISOString() })
  const { data: out, error } = await supabase.from(table).update(row).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  return fromRow(out)
}

async function upsert(table, data) {
  const { tenantId, uid } = ctx()
  const row = toRow({
    ...data,
    tenantId,
    creadoPor: data.creadoPor || uid,
    updatedBy: uid,
    updatedAt: new Date().toISOString(),
  })
  const { data: out, error } = await supabase.from(table).upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  return fromRow(out)
}

// Tablas donde el UPDATE directo vía PostgREST para poner activo=false
// queda bloqueado por RLS sin explicación raíz (ver notas 2026-07-16 en
// CLAUDE.md) — se resuelve vía función RPC SECURITY DEFINER en vez de
// seguir depurando la policy tabla por tabla.
const RPC_SOFT_DELETE = {
  documentos: 'soft_delete_documento',
  matriz_riesgos: 'soft_delete_matriz_riesgos',
  actas: 'soft_delete_acta',
}

// No pide la fila de vuelta (`.select()`): las políticas RLS de SELECT
// exigen `activo = true`, así que en cuanto esta misma escritura la pone
// en `false` la fila deja de ser visible para el RETURNING y Postgres
// rechaza la operación completa con "new row violates row-level security
// policy" — aunque la política de UPDATE nunca mencione `activo`.
async function softDelete(table, id) {
  const rpcFn = RPC_SOFT_DELETE[table]
  if (rpcFn) {
    const { error } = await supabase.rpc(rpcFn, { p_id: id })
    if (error) throw new Error(error.message)
    return
  }
  const { uid } = ctx()
  const row = toRow({ activo: false, deletedAt: new Date().toISOString(), updatedBy: uid, updatedAt: new Date().toISOString() })
  const { error } = await supabase.from(table).update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export default { list, getById, insert, update, upsert, softDelete, toRow, fromRow }
