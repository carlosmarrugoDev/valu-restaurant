// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Función para ejecutar SQL directo (para migración)
export async function executeSQL(sql: string, params: any[] = []) {
  const { data, error } = await supabase.rpc('execute_sql', {
    query_text: sql,
    query_params: params
  })
  if (error) throw error
  return data
}