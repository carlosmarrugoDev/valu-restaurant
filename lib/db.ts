// lib/db.ts
import { supabase } from './supabase'

export async function query(text: string, params?: any[]) {
  // Esta función ahora intentará ejecutar SQL usando la función RPC de Supabase
  // que creamos en la migración. Si no existe, fallará elegantemente.
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: text,
      query_params: params || []
    })

    if (error) {
      // Si el error es porque la función RPC no existe, intentamos un enfoque directo
      if (error.message.includes('execute_sql')) {
        console.warn('Función execute_sql no encontrada, usando enfoque directo')
        return await executeDirectQuery(text, params)
      }
      console.error('DB RPC Error:', error)
      throw error
    }

    return { rows: data || [], rowCount: (data || []).length }
  } catch (error: any) {
    console.error('Query error:', error)
    // Si falla, intentamos con el enfoque directo como fallback
    return await executeDirectQuery(text, params)
  }
}

// Función de fallback para consultas directas (menos potente pero funcional)
async function executeDirectQuery(text: string, params?: any[]) {
  const trimmed = text.trim().toLowerCase()
  const tableMatch = text.match(/from\s+(\w+)/i) || text.match(/into\s+(\w+)/i) || text.match(/update\s+(\w+)/i) || text.match(/delete\s+from\s+(\w+)/i)
  const tableName = tableMatch ? tableMatch[1] : null

  if (!tableName) {
    throw new Error('No se pudo determinar la tabla para la consulta directa')
  }

  // Para SELECT
  if (trimmed.startsWith('select')) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
    
    if (error) throw error
    return { rows: data || [], rowCount: (data || []).length }
  }

  // Para INSERT (con params)
  if (trimmed.startsWith('insert') && params && params.length > 0) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(params[0])
      .select()
    
    if (error) throw error
    return { rows: data || [], rowCount: (data || []).length }
  }

  // Para UPDATE (con params)
  if (trimmed.startsWith('update') && params && params.length > 0) {
    // Extraer el ID de la cláusula WHERE (muy básico)
    const idMatch = text.match(/where\s+id\s*=\s*['"]?(\d+)['"]?/i)
    if (idMatch) {
      const { data, error } = await supabase
        .from(tableName)
        .update(params[0])
        .eq('id', parseInt(idMatch[1]))
        .select()
      
      if (error) throw error
      return { rows: data || [], rowCount: (data || []).length }
    }
  }

  // Para DELETE (con params)
  if (trimmed.startsWith('delete') && params && params.length > 0) {
    const idMatch = text.match(/where\s+id\s*=\s*['"]?(\d+)['"]?/i)
    if (idMatch) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', parseInt(idMatch[1]))
      
      if (error) throw error
      return { rows: [], rowCount: 0 }
    }
  }

  throw new Error(`No se pudo ejecutar la consulta directa: ${text.substring(0, 50)}`)
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