// Edge Function: registrar-tenant
// Autoregistro público — crea tenant + usuario ADMIN sin intervención manual.
// Público (sin auth previa): valida y sanea el body en vez de confiar en el caller.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRIAL_DIAS = 14

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

  let body: { empresaNombre?: string; contactoNombre?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body JSON inválido' }, 400)
  }

  const empresaNombre  = (body.empresaNombre  || '').trim()
  const contactoNombre = (body.contactoNombre || '').trim()
  const email           = (body.email          || '').toLowerCase().trim()
  const password         = body.password         || ''

  if (!empresaNombre || !contactoNombre || !email || !password) {
    return json({ error: 'Faltan campos requeridos: empresaNombre, contactoNombre, email, password' }, 400)
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Correo electrónico inválido' }, 400)
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
  }

  // 1. Crear usuario en Auth (sin tenant_id aún — se completa en el paso 3)
  const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: contactoNombre },
    app_metadata:  {},
  })

  if (createErr) {
    if (createErr.message.includes('already been registered')) {
      return json({ error: 'Ya existe una cuenta con ese correo' }, 409)
    }
    return json({ error: createErr.message }, 500)
  }

  const uid = newAuth.user.id

  // 2. Crear tenant en estado trial
  const trialEnds = new Date(Date.now() + TRIAL_DIAS * 24 * 60 * 60 * 1000).toISOString()

  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      nombre:          empresaNombre,
      nombre_corto:    empresaNombre.slice(0, 30),
      tipo:            'empresa',
      plan:            'starter',
      estado:          'trial',
      trial_ends:      trialEnds,
      empresas_limite: 3,
      activo:          true,
      email,
      admin_uid:       uid,
      updated_by:      uid,
    })
    .select('id')
    .single()

  if (tenantErr) {
    await supabaseAdmin.auth.admin.deleteUser(uid)
    return json({ error: `Error al crear la cuenta: ${tenantErr.message}` }, 500)
  }

  const tenantId = tenant.id

  // 3. Completar app_metadata del usuario con el tenant recién creado
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(uid, {
    app_metadata: { tenant_id: tenantId, role: 'ADMIN', empresas_ids: [] },
  })
  if (metaErr) {
    await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
    await supabaseAdmin.auth.admin.deleteUser(uid)
    return json({ error: `Error al configurar la cuenta: ${metaErr.message}` }, 500)
  }

  // 4. Documento de usuario
  const { error: userErr } = await supabaseAdmin.from('usuarios').insert({
    id:           uid,
    tenant_id:    tenantId,
    nombre:       contactoNombre,
    email,
    rol:          'ADMIN',
    activo:       true,
    empresas_ids: [],
    updated_by:   uid,
    creado_por:   uid,
  })

  if (userErr) {
    await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
    await supabaseAdmin.auth.admin.deleteUser(uid)
    return json({ error: `Error al registrar el usuario: ${userErr.message}` }, 500)
  }

  return json({ uid, tenant_id: tenantId, email }, 201)
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
