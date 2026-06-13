// Edge Function: crear-tenant
// Crea el tenant inicial y setea app_metadata del usuario ADMIN.
// Solo invocable con service role key (script de provisión).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { admin_uid, admin_email, admin_nombre, tenant_nombre, tenant_nombre_corto, tenant_tipo, tenant_plan } =
    await req.json()

  if (!admin_uid || !admin_email) {
    return new Response(JSON.stringify({ error: 'Faltan admin_uid y/o admin_email' }), { status: 400 })
  }

  // 1. Crear tenant
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      nombre:        tenant_nombre || 'Mi Tenant',
      nombre_corto:  tenant_nombre_corto || 'Tenant',
      tipo:          tenant_tipo || 'consultora',
      plan:          tenant_plan || 'starter',
      activo:        true,
      email:         admin_email,
      admin_uid:     admin_uid,
      updated_by:    admin_uid,
    })
    .select('id')
    .single()

  if (tenantErr) return new Response(JSON.stringify({ error: tenantErr.message }), { status: 500 })

  const tenantId = tenant.id

  // 2. Setear app_metadata con tenantId y rol ADMIN
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(admin_uid, {
    app_metadata: { tenant_id: tenantId, role: 'ADMIN', empresas_ids: [] },
  })
  if (metaErr) return new Response(JSON.stringify({ error: metaErr.message }), { status: 500 })

  // 3. Crear documento de usuario
  const { error: userErr } = await supabaseAdmin.from('usuarios').insert({
    id:          admin_uid,
    tenant_id:   tenantId,
    nombre:      admin_nombre || admin_email,
    email:       admin_email.toLowerCase(),
    rol:         'ADMIN',
    activo:      true,
    empresas_ids: [],
    updated_by:  admin_uid,
    creado_por:  admin_uid,
  })
  if (userErr) return new Response(JSON.stringify({ error: userErr.message }), { status: 500 })

  return new Response(JSON.stringify({ tenant_id: tenantId, uid: admin_uid }), { status: 200 })
})
