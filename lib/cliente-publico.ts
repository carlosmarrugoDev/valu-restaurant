import { supabase } from '@/lib/supabase'

export type MesaPublica = {
  id: string
  nombre: string
  tenant_id: string
  sucursal_id: string | null
  estado: string
}

export function slugMesa(nombre: string) {
  return (nombre || '').toLowerCase().trim().replace(/\s+/g, '-')
}

export function coincideSlug(nombre: string, slug: string) {
  const s = slug.toLowerCase().trim()
  const n = (nombre || '').toLowerCase().trim()
  return n === s || slugMesa(n) === s || n === s.replace(/-/g, ' ')
}

export async function resolverMesaPublica(
  mesaSlug: string | null,
  mesaId: string | null,
): Promise<MesaPublica | null> {
  if (mesaId) {
    const { data } = await supabase
      .from('mesas')
      .select('id, nombre, tenant_id, sucursal_id, estado')
      .eq('id', mesaId)
      .maybeSingle()
    if (data) return data as MesaPublica
  }

  if (!mesaSlug) return null

  const { data: mesas } = await supabase
    .from('mesas')
    .select('id, nombre, tenant_id, sucursal_id, estado')

  const encontrada = (mesas || []).find((m) => coincideSlug(m.nombre, mesaSlug))
  return (encontrada as MesaPublica) || null
}

export async function usuarioParaPedidoQr(tenantId: string, mesaId: string): Promise<string | null> {
  const { data: asignacion } = await supabase
    .from('asignaciones_mesa')
    .select('usuario_id')
    .eq('mesa_id', mesaId)
    .eq('activa', true)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (asignacion?.usuario_id) return asignacion.usuario_id

  const { data: dueno } = await supabase
    .from('usuarios')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('rol', ['dueno', 'gerente', 'admin'])
    .limit(1)
    .maybeSingle()

  const { data: cualquiera } = await supabase
    .from('usuarios')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle()

  return cualquiera?.id || null
}

export async function pedidoConItems(pedidoId: string) {
  try {
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) return null

    const { data: items } = await supabase
      .from('pedido_items')
      .select('*')
      .eq('pedido_id', pedidoId)

    let mesa_nombre = null
    let cocinero_nombre = null

    try {
      if ((pedido as any).mesa_id) {
        const { data: mesa } = await supabase
          .from('mesas')
          .select('nombre')
          .eq('id', (pedido as any).mesa_id)
          .maybeSingle()
        if (mesa) mesa_nombre = mesa.nombre || null
      }
    } catch { /* no-op */ }

    try {
      if ((pedido as any).cocinero_id) {
        const { data: cocinero } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', (pedido as any).cocinero_id)
          .maybeSingle()
        if (cocinero) cocinero_nombre = cocinero.nombre || null
      }
    } catch { /* no-op */ }

    return {
      ...pedido,
      mesa_nombre,
      cocinero_nombre,
      items: items || [],
    }
  } catch {
    return null
  }
}
