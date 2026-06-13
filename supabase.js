import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL    = 'https://ifqzdrqzjgsdhjbqkbba.supabase.co'
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmcXpkcnF6amdzZGhqYnFrYmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTIyMzcsImV4cCI6MjA5NjkyODIzN30.t1TCSiq9xNz7Dup4NNzwU5Xw5DFRl-wVDu-7eVAFMSo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})
