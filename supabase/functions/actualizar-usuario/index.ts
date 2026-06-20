// Edge Function: actualizar-usuario
// Actualiza empresas_ids y/o rol de un usuario existente en app_metadata y tabla usuarios.
// Solo invocable por usuarios con rol ADMIN del mismo tenant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ROLES_VALIDOS = ['ADMIN', 'ASESOR', 'CONSULTA']

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

  const callerMeta   = caller.app_metadata || {}
  const callerRol    = callerMeta.role as string
  const callerTenant = callerMeta.tenant_id as string

  if (callerRol !== 'ADMIN') return json({ error: 'Solo los ADMIN pueden modificar usuarios' }, 403)
  if (!callerTenant)         return json({ error: 'El usuario llamante no tiene tenant asignado' }, 403)

  let body: { uid?: string; empresasIds?: string[]; rol?: string }
  try { body = await req.json() } catch { return json({ error: 'Body JSON inválido' }, 400) }

  const { uid, empresasIds, rol } = body

  if (!uid) return json({ error: 'Falta uid del usuario a modificar' }, 400)
  if (rol && !ROLES_VALIDOS.includes(rol)) {
    return json({ error: `Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}` }, 400)
  }
  if (rol === 'ROOT') return json({ error: 'El rol ROOT no puede asignarse desde esta función' }, 403)

  // Verificar que el usuario a modificar pertenece al mismo tenant
  const { data: target, error: fetchErr } = await supabaseAdmin
    .from('usuarios')
    .select('id, tenant_id, rol, empresas_ids')
    .eq('id', uid)
    .single()

  if (fetchErr || !target) return json({ error: 'Usuario no encontrado' }, 404)
  if (target.tenant_id !== callerTenant) return json({ error: 'No puedes modificar usuarios de otro tenant' }, 403)

  // Obtener app_metadata actual para hacer merge
  const { data: { user: targetAuth }, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(uid)
  if (targetErr || !targetAuth) return json({ error: 'Usuario no encontrado en Auth' }, 404)

  const currentMeta = targetAuth.app_metadata || {}
  const newMeta = {
    ...currentMeta,
    ...(empresasIds !== undefined ? { empresas_ids: empresasIds } : {}),
    ...(rol          !== undefined ? { role: rol }               : {}),
  }

  // Actualizar app_metadata en Auth
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
    app_metadata: newMeta,
  })
  if (metaErr) return json({ error: metaErr.message }, 500)

  // Actualizar tabla usuarios
  const updateData: Record<string, unknown> = { updated_by: caller.id }
  if (empresasIds !== undefined) updateData.empresas_ids = empresasIds
  if (rol          !== undefined) updateData.rol          = rol

  const { error: dbErr } = await supabaseAdmin
    .from('usuarios')
    .update(updateData)
    .eq('id', uid)

  if (dbErr) return json({ error: `Error actualizando tabla: ${dbErr.message}` }, 500)

  return json({
    uid,
    empresas_ids: newMeta.empresas_ids,
    rol:          newMeta.role,
  }, 200)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
