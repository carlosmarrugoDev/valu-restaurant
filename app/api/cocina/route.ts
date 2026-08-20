// app/api/cocina/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado') || 'en_cocina'

    // Obtener pedidos en cocina
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select(`
        *,
        mesas!mesa_id (nombre),
        usuarios!mesero_id (nombre)
      `)
      .eq('tenant_id', user.tenantId)
      .in('estado', ['en_cocina', 'listo'])
      .order('fecha_creacion', { ascending: true })

    // Obtener items para cada pedido
    const pedidosConItems = await Promise.all((pedidos || []).map(async (p) => {
      const { data: items } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', p.id)
        .in('estado', ['pendiente', 'en_cocina', 'listo'])

      const segundosTranscurridos = p.fecha_creacion
        ? Math.floor((Date.now() - new Date(p.fecha_creacion).getTime()) / 1000)
        : 0

      return {
        ...p,
        mesa_nombre: p.mesas?.nombre || null,
        mesero_nombre: p.usuarios?.nombre || null,
        items: items || [],
        segundos_transcurridos: segundosTranscurridos,
        mesas: undefined,
        usuarios: undefined,
      }
    }))

    return NextResponse.json({ success: true, pedidos: pedidosConItems })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { pedido_id, item_id, tipo } = body

    if (!pedido_id && !item_id) {
      return NextResponse.json({ error: 'pedido_id o item_id requerido' }, { status: 400 })
    }

    if (item_id) {
      // Marcar item como listo
      const { error: itemError } = await supabase
        .from('pedido_items')
        .update({ estado: 'listo' })
        .eq('id', item_id)

      if (itemError) throw itemError

      // Verificar si todos los items están listos
      const { data: items } = await supabase
        .from('pedido_items')
        .select('estado')
        .eq('pedido_id', pedido_id)

      const todosListos = items?.every(i => i.estado === 'listo')

      if (todosListos) {
        await supabase
          .from('pedidos')
          .update({
            estado: 'listo',
            fecha_actualizacion: new Date().toISOString()
          })
          .eq('id', pedido_id)
          .eq('tenant_id', user.tenantId)
      }

      return NextResponse.json({ success: true, message: 'Item marcado como listo' })
    }

    if (pedido_id) {
      // Marcar todos los items como listos
      await supabase
        .from('pedido_items')
        .update({ estado: 'listo' })
        .eq('pedido_id', pedido_id)
        .in('estado', ['pendiente', 'en_cocina'])

      await supabase
        .from('pedidos')
        .update({
          estado: 'listo',
          fecha_actualizacion: new Date().toISOString()
        })
        .eq('id', pedido_id)
        .eq('tenant_id', user.tenantId)

      return NextResponse.json({ success: true, message: 'Pedido marcado como listo' })
    }

    return NextResponse.json({ error: 'Operación inválida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}