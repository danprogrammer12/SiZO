import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const clean = line.trim()
    if (!clean || clean.startsWith('#')) continue
    const idx = clean.indexOf('=')
    if (idx === -1) continue
    const k = clean.slice(0, idx).trim()
    const v = clean.slice(idx + 1).trim()
    process.env[k] = v
  }
} catch (e) {
  console.log('Error reading env:', e)
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const TENANT_ID = 'e2816d5d-1d6e-499f-b272-bb04cd22ac8b'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Starting company creation and assignment...')

  // 1. Resolve Admin user info
  const { data: adminUser, error: adminErr } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('tenant_id', TENANT_ID)
    .eq('rol', 'ADMIN')
    .limit(1)
    .single()

  if (adminErr) {
    console.error('Error finding admin user:', adminErr.message)
    process.exit(1)
  }
  const adminId = adminUser.id
  console.log(`Found Admin user: ${adminUser.email} (${adminId})`)

  // 2. Define companies to insert
  const companiesToInsert = [
    { nombre: 'Distribuciones Caribe Ltda', nit: '900111222-1', ciudad: 'Barranquilla', clase_riesgo: 'II' },
    { nombre: 'Seguridad Global S.A.S.', nit: '900333444-2', ciudad: 'Bogotá', clase_riesgo: 'III' }
  ]

  for (const comp of companiesToInsert) {
    const { data: existing, error: findErr } = await supabase
      .from('empresas')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('nombre', comp.nombre)
      .maybeSingle()

    if (findErr) {
      console.error(`Error checking company ${comp.nombre}:`, findErr.message)
      continue
    }

    if (!existing) {
      const { data: inserted, error: insErr } = await supabase
        .from('empresas')
        .insert({
          tenant_id: TENANT_ID,
          nombre: comp.nombre,
          nit: comp.nit,
          ciudad: comp.ciudad,
          trab: 25,
          nivel_riesgo: comp.clase_riesgo,
          clase_riesgo: comp.clase_riesgo,
          copasst: 'copasst',
          activa: true,
          creado_por: adminId,
          updated_by: adminId
        })
        .select()
        .single()

      if (insErr) {
        console.error(`Error inserting company ${comp.nombre}:`, insErr.message)
      } else {
        console.log(`✓ Created company: ${inserted.nombre} (${inserted.id})`)
      }
    } else {
      console.log(`ℹ Company already exists: ${comp.nombre} (${existing.id})`)
    }
  }

  // 3. Resolve all active companies in tenant
  const { data: allCompanies, error: listErr } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('tenant_id', TENANT_ID)
    .eq('activa', true)

  if (listErr) {
    console.error('Error listing tenant companies:', listErr.message)
    process.exit(1)
  }

  const companyIds = allCompanies.map(c => c.id)
  console.log(`Found ${companyIds.length} active companies for assignment.`)

  // 4. Assign to users in Auth metadata and database
  const targetEmails = ['danias12.dpa@gmail.com', 'asesor-prueba-root@webcore.tec']

  const { data: { users }, error: listUsersErr } = await supabase.auth.admin.listUsers()
  if (listUsersErr) {
    console.error('Error listing auth users:', listUsersErr.message)
    process.exit(1)
  }

  for (const email of targetEmails) {
    const authUser = users.find(u => u.email === email.toLowerCase())
    if (!authUser) {
      console.log(`⚠ User ${email} not found in Supabase Auth. Skipping.`)
      continue
    }

    // Update Supabase Auth app_metadata
    const currentMeta = authUser.app_metadata || {}
    const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(authUser.id, {
      app_metadata: { ...currentMeta, empresas_ids: companyIds }
    })

    if (updateAuthErr) {
      console.error(`Error updating Auth metadata for ${email}:`, updateAuthErr.message)
    } else {
      console.log(`✓ Updated Auth metadata for ${email}`)
    }

    // Update public.usuarios table
    const { error: updateDbErr } = await supabase
      .from('usuarios')
      .update({ empresas_ids: companyIds })
      .eq('id', authUser.id)

    if (updateDbErr) {
      console.error(`Error updating usuarios table for ${email}:`, updateDbErr.message)
    } else {
      console.log(`✓ Updated usuarios table row for ${email}`)
    }
  }

  console.log('Assignment completed successfully.')
}

main().catch(err => {
  console.error('Unexpected error:', err.message)
  process.exit(1)
})
