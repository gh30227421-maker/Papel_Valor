import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL no está definida o no es válida en .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
