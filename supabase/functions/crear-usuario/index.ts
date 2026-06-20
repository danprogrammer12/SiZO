// Edge Function: crear-usuario
// Crea un usuario en Auth + usuarios tabla para un tenant.
// Solo invocable por usuarios con rol ADMIN del mismo tenant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ROLES_VALIDOS = ['ADMIN', 'ASESOR', 'CONSULTA']

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  // Verificar que el caller sea ADMIN del tenant
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    return json({ error: 'No autorizado' }, 401)
  }

  // Decodificar JWT sin verificar firma (Supabase ya lo verificó al generar el token)
  // Usamos getUser para validar el token contra Supabase Auth
  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)

  if (authErr || !caller) {
    return json({ error: 'Token inválido o expirado' }, 401)
  }

  const callerMeta  = caller.app_metadata || {}
  const callerRol   = callerMeta.role as string
  const callerTenant = callerMeta.tenant_id as string

  if (callerRol !== 'ADMIN') {
    return json({ error: 'Solo los usuarios ADMIN pueden crear usuarios' }, 403)
  }
  if (!callerTenant) {
    return json({ error: 'El usuario llamante no tiene tenant asignado' }, 403)
  }

  // Parsear body
  let body: { email?: string; nombre?: string; rol?: string; empresasIds?: string[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body JSON inválido' }, 400)
  }

  const { email, nombre, rol, empresasIds = [] } = body

  if (!email || !nombre || !rol) {
    return json({ error: 'Faltan campos requeridos: email, nombre, rol' }, 400)
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return json({ error: `Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}` }, 400)
  }
  if (rol === 'ROOT') {
    return json({ error: 'El rol ROOT no puede crearse desde esta función' }, 403)
  }

  // Crear usuario en Supabase Auth
  const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email:            email.toLowerCase().trim(),
    email_confirm:    true,
    user_metadata:    { nombre },
    app_metadata:     {
      tenant_id:    callerTenant,
      role:         rol,
      empresas_ids: empresasIds,
    },
  })

  if (createErr) {
    if (createErr.message.includes('already been registered')) {
      return json({ error: 'Ya existe un usuario con ese correo' }, 409)
    }
    return json({ error: createErr.message }, 500)
  }

  const newUid = newAuth.user.id

  // Insertar en tabla usuarios
  const { error: insertErr } = await supabaseAdmin.from('usuarios').insert({
    id:           newUid,
    tenant_id:    callerTenant,
    nombre:       nombre.trim(),
    email:        email.toLowerCase().trim(),
    rol:          rol,
    activo:       true,
    empresas_ids: empresasIds,
    updated_by:   caller.id,
    creado_por:   caller.id,
  })

  if (insertErr) {
    // Revertir: eliminar el usuario de Auth para no dejar estado inconsistente
    await supabaseAdmin.auth.admin.deleteUser(newUid)
    return json({ error: `Error al registrar usuario en la base de datos: ${insertErr.message}` }, 500)
  }

  // Enviar invitación para que el usuario establezca su contraseña
  const { error: inviteErr } = await supabaseAdmin.auth.admin.generateLink({
    type:       'recovery',
    email:      email.toLowerCase().trim(),
    options:    { redirectTo: Deno.env.get('APP_URL') || '' },
  })

  // No es fatal si el envío de invitación falla — el usuario ya fue creado
  if (inviteErr) {
    console.warn('[crear-usuario] No se pudo generar link de invitación:', inviteErr.message)
  }

  return json({ uid: newUid, email: email.toLowerCase().trim(), rol, tenant_id: callerTenant }, 201)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  '*',
    },
  })
}
