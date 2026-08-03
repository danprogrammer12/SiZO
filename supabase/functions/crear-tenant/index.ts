// Edge Function: crear-tenant
// Crea un tenant nuevo + su usuario ADMIN inicial (ambos desde cero) y setea
// su app_metadata. Invocable por ROOT desde el panel de plataforma.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    return json({ error: 'Solo ROOT puede crear tenants' }, 403)
  }

  let body: {
    tenant_nombre?: string; tenant_nombre_corto?: string
    tenant_tipo?: string; tenant_plan?: string
    admin_email?: string; admin_nombre?: string
  }
  try { body = await req.json() } catch { return json({ error: 'Body JSON inválido' }, 400) }

  const {
    tenant_nombre, tenant_nombre_corto, tenant_tipo = 'consultora', tenant_plan = 'starter',
    admin_email, admin_nombre,
  } = body

  if (!tenant_nombre || !admin_email || !admin_nombre) {
    return json({ error: 'Faltan campos requeridos: tenant_nombre, admin_email, admin_nombre' }, 400)
  }

  const email = admin_email.toLowerCase().trim()

  // 1. Crear usuario ADMIN en Auth (sin tenant_id aún — se completa en el paso 3)
  const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nombre: admin_nombre },
    app_metadata:  {},
  })

  if (createErr) {
    if (createErr.message.includes('already been registered')) {
      return json({ error: 'Ya existe una cuenta con ese correo' }, 409)
    }
    return json({ error: createErr.message }, 500)
  }

  const adminUid = newAuth.user.id

  // 2. Crear tenant
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      nombre:        tenant_nombre,
      nombre_corto:  tenant_nombre_corto || tenant_nombre.slice(0, 30),
      tipo:          tenant_tipo,
      plan:          tenant_plan,
      activo:        true,
      email,
      admin_uid:     adminUid,
      updated_by:    caller.id,
    })
    .select('id')
    .single()

  if (tenantErr) {
    await supabaseAdmin.auth.admin.deleteUser(adminUid)
    return json({ error: `Error al crear el tenant: ${tenantErr.message}` }, 500)
  }

  const tenantId = tenant.id

  // 3. Completar app_metadata del ADMIN con el tenant recién creado
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(adminUid, {
    app_metadata: { tenant_id: tenantId, role: 'ADMIN', empresas_ids: [] },
  })
  if (metaErr) {
    await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
    await supabaseAdmin.auth.admin.deleteUser(adminUid)
    return json({ error: `Error al configurar la cuenta: ${metaErr.message}` }, 500)
  }

  // 4. Documento de usuario
  const { error: userErr } = await supabaseAdmin.from('usuarios').insert({
    id:           adminUid,
    tenant_id:    tenantId,
    nombre:       admin_nombre,
    email,
    rol:          'ADMIN',
    activo:       true,
    empresas_ids: [],
    updated_by:   caller.id,
    creado_por:   caller.id,
  })

  if (userErr) {
    await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
    await supabaseAdmin.auth.admin.deleteUser(adminUid)
    return json({ error: `Error al registrar el usuario: ${userErr.message}` }, 500)
  }

  // 5. Invitación para que el ADMIN establezca su contraseña
  const { error: inviteErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: Deno.env.get('APP_URL') || '' },
  })
  if (inviteErr) {
    console.warn('[crear-tenant] No se pudo generar link de invitación:', inviteErr.message)
  }

  await supabaseAdmin.from('plataforma_auditoria').insert({
    actor_uid:   caller.id,
    actor_email: caller.email || '',
    accion:      'crear_tenant',
    detalle:     { tenantId, adminUid, email },
  })

  return json({ tenant_id: tenantId, uid: adminUid }, 201)
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
