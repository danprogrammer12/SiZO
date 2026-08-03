// Edge Function: gestionar-usuario-root
// Suspender / reactivar / eliminar cualquier usuario de cualquier tenant.
// Exclusiva de ROOT — ADMIN gestiona altas/bajas de su tenant por otras vías,
// pero suspender/reactivar/eliminar cross-tenant queda reservado a la plataforma.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACCIONES_VALIDAS = ['suspender', 'reactivar', 'eliminar']

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'No autorizado' }, 401)

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return json({ error: 'Token inválido o expirado' }, 401)

  if ((caller.app_metadata || {}).role !== 'ROOT') {
    return json({ error: 'Solo ROOT puede ejecutar esta acción' }, 403)
  }

  let body: { uid?: string; accion?: string }
  try { body = await req.json() } catch { return json({ error: 'Body JSON inválido' }, 400) }

  const { uid, accion } = body
  if (!uid || !accion) return json({ error: 'Faltan campos requeridos: uid, accion' }, 400)
  if (!ACCIONES_VALIDAS.includes(accion)) {
    return json({ error: `Acción inválida. Valores permitidos: ${ACCIONES_VALIDAS.join(', ')}` }, 400)
  }
  if (uid === caller.id) return json({ error: 'No puedes ejecutar esta acción sobre tu propia cuenta' }, 403)

  const { data: targetAuth, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(uid)
  if (targetErr || !targetAuth?.user) return json({ error: 'Usuario no encontrado' }, 404)

  if (accion === 'suspender') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: '876000h' })
    if (error) return json({ error: error.message }, 500)
    await supabaseAdmin.from('usuarios').update({ activo: false, updated_by: caller.id }).eq('id', uid)
  }

  if (accion === 'reactivar') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: 'none' })
    if (error) return json({ error: error.message }, 500)
    await supabaseAdmin.from('usuarios').update({ activo: true, updated_by: caller.id }).eq('id', uid)
  }

  if (accion === 'eliminar') {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (error) return json({ error: error.message }, 500)
    // No hay delete físico en `usuarios` (política RLS lo bloquea) — se marca
    // inactivo y con deleted_at para conservar trazabilidad histórica.
    await supabaseAdmin.from('usuarios')
      .update({ activo: false, deleted_at: new Date().toISOString(), updated_by: caller.id })
      .eq('id', uid)
  }

  await supabaseAdmin.from('plataforma_auditoria').insert({
    actor_uid:   caller.id,
    actor_email: caller.email || '',
    accion:      `usuario_${accion}`,
    detalle:     { uid },
  })

  return json({ uid, accion }, 200)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
