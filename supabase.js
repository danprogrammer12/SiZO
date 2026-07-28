// supabase-js vendorizado y fijado (H6): se sirve desde el repo, no desde un CDN.
// Elimina el riesgo de cadena de suministro (compromiso del CDN) y de disponibilidad.
// Para actualizar: descargar el bundle de la versión deseada desde esm.sh
//   https://esm.sh/@supabase/supabase-js@<ver>/es2020/supabase-js.bundle.mjs
//   + sus polyfills /node/*.mjs, reescribir rutas a ./node/ y reemplazar vendor/.
import { createClient } from './vendor/supabase-js@2.108.1.js'

const SUPABASE_URL    = 'https://zfdiloozznodysbsrqhv.supabase.co'
const SUPABASE_ANON   = 'sb_publishable_0o5DgsXBP3FpLk6-Weo9Eg_4-BdIkP3'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})
