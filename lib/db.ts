// lib/db.ts
import { supabase } from './supabase'

export async function query(text: string, params?: any[]) {
  try {
    // Usar consulta directa con Supabase (evitar RPC)
    // Para consultas simples, usamos el método de Supabase directamente
    console.log('Query:', text.slice(0, 100))
    
    // Si la consulta es un SELECT simple, usar supabase.from
    if (text.trim().toLowerCase().startsWith('select')) {
      // Extraer tabla de la consulta (muy básico)
      const tableMatch = text.match(/from\s+(\w+)/i)
      if (tableMatch) {
        const table = tableMatch[1]
        const { data, error } = await supabase
          .from(table)
          .select('*')
        
        if (error) throw error
        return { rows: data || [], rowCount: (data || []).length }
      }
    }
    
    // Para INSERT/UPDATE/DELETE, usar el método correspondiente
    if (text.trim().toLowerCase().startsWith('insert')) {
      const tableMatch = text.match(/into\s+(\w+)/i)
      if (tableMatch && params) {
        const table = tableMatch[1]
        // Intentar extraer datos del INSERT
        const { data, error } = await supabase
          .from(table)
          .insert(params[0] || {})
          .select()
        
        if (error) throw error
        return { rows: data || [], rowCount: (data || []).length }
      }
    }
    
    // Fallback: intentar con RPC
    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: text,
      query_params: params || []
    })
    
    if (error) {
      console.error('DB Error:', error)
      throw error
    }
    
    return { rows: data || [], rowCount: (data || []).length }
  } catch (error: any) {
    console.error('Query error:', error)
    // Retornar vacío para no romper la app
    return { rows: [], rowCount: 0 }
  }
}

export async function getClient() {
  return {
    query: query,
    release: () => {}
  }
}

export const pool = {
  query: query
}