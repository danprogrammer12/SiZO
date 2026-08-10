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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function inspect() {
  const { data: companies, error: cErr } = await supabase.from('empresas').select('id, nombre, tenant_id')
  if (cErr) console.error('Error fetching companies:', cErr)
  else console.log('Companies in DB:', companies)

  const { data: users, error: uErr } = await supabase.from('usuarios').select('id, email, rol, empresas_ids')
  if (uErr) console.error('Error fetching users:', uErr)
  else console.log('Users in DB:', users)
}

inspect()
