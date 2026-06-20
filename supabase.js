// supabase-js vendorizado y fijado (H6): se sirve desde el repo, no desde un CDN.
// Elimina el riesgo de cadena de suministro (compromiso del CDN) y de disponibilidad.
// Para actualizar: descargar el bundle de la versión deseada desde esm.sh
//   https://esm.sh/@supabase/supabase-js@<ver>/es2020/supabase-js.bundle.mjs
//   + sus polyfills /node/*.mjs, reescribir rutas a ./node/ y reemplazar vendor/.
import { createClient } from './vendor/supabase-js@2.108.1.js'

const SUPABASE_URL    = 'https://ifqzdrqzjgsdhjbqkbba.supabase.co'
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmcXpkcnF6amdzZGhqYnFrYmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTIyMzcsImV4cCI6MjA5NjkyODIzN30.t1TCSiq9xNz7Dup4NNzwU5Xw5DFRl-wVDu-7eVAFMSo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})
