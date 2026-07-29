// Carga .env manualmente (mismo patrón que scripts/test-seguridad-rls.mjs) —
// evita añadir dotenv como dependencia nueva solo para esto.
import { readFileSync } from 'node:fs'

function loadEnv() {
  const vars = {}
  let raw
  try {
    raw = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
  } catch {
    throw new Error('No se encontró .env en la raíz del proyecto. Copia .env.example y complétalo.')
  }
  for (const line of raw.split('\n')) {
    const l = line.trim()
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('=')
    if (i === -1) continue
    vars[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  }
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SIZO_ADMIN_EMAIL']) {
    if (!vars[k]) throw new Error(`Falta ${k} en .env — requerido para las pruebas de tests/`)
  }
  return vars
}

export const ENV = loadEnv()
