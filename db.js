// ─────────────────────────────────────────────────────────────
// SIZO — Capa de acceso a datos (Supabase)
// Envuelve el cliente con conversión camelCase ↔ snake_case y
// campos de auditoría automáticos. Las RLS policies del schema
// garantizan el aislamiento por tenant; aquí solo se inyectan
// tenant_id y los campos de auditoría en escrituras.
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase.js'
import { get }      from './store.js'

const toSnake = s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

function keysTo(fn, obj) {
  if (Array.isArray(obj)) return obj.map(o => keysTo(fn, o))
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const out = {}
    for (const k in obj) out[fn(k)] = obj[k]
    return out
  }
  return obj
}

const toRow = obj => keysTo(toSnake, obj)
const fromRow = obj => keysTo(toCamel, obj)

function ctx() {
  const user = get('user') || {}
  return { tenantId: user.tenantId, uid: user.uid }
}

// ── Lectura ──────────────────────────────────────────────────
async function list(table, { eq = {}, order, ascending = true } = {}) {
  let q = supabase.from(table).select('*')
  for (const [col, val] of Object.entries(eq)) q = q.eq(toSnake(col), val)
  if (order) q = q.order(toSnake(order), { ascending })
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

async function softDelete(table, id) {
  return update(table, id, { activo: false, deletedAt: new Date().toISOString() })
}

export default { list, getById, insert, update, upsert, softDelete, toRow, fromRow }
