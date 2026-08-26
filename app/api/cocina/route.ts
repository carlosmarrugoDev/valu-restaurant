import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select(`
        *,
        mesas!mesa_id (nombre),
        usuarios!mesero_id (nombre),
        cocinero:usuarios!cocinero_id (nombre)
      `)
      .eq('tenant_id', user.tenantId)
      .in('estado', ['en_espera_cocina', 'en_preparacion', 'listo'])
      .order('fecha_creacion', { ascending: true })

    const pedidosConItems = await Promise.all((pedidos || []).map(async (p: any) => {
      const { data: items } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', p.id)
        .in('estado', ['pendiente', 'en_preparacion', 'listo'])

      const segundosTranscurridos = p.fecha_creacion
        ? Math.floor((Date.now() - new Date(p.fecha_creacion).getTime()) / 1000)
        : 0

      return {
        ...p,
        mesa_nombre: p.mesas?.nombre || null,
        mesero_nombre: p.usuarios?.nombre || null,
        cocinero_nombre: p.cocinero?.nombre || null,
        items: items || [],
        segundos_transcurridos: segundosTranscurridos,
        mesas: undefined,
        usuarios: undefined,
        cocinero: undefined,
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

    if (pedido_id) {
      const { data: pedidoActual } = await supabase
        .from('pedidos')
        .select('id, estado, cocinero_id')
        .eq('id', pedido_id)
        .eq('tenant_id', user.tenantId)
        .single()

      if (!pedidoActual) {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      }

      const esAdmin = user.rol === 'dueno' || user.rol === 'gerente'
      const tomadoPorMi = pedidoActual.cocinero_id === user.userId
      const sinAsignar = !pedidoActual.cocinero_id

      if (!sinAsignar && !tomadoPorMi && !esAdmin) {
        return NextResponse.json(
          { error: 'Solo el cocinero asignado o un administrador puede marcar este pedido' },
          { status: 403 }
        )
      }
    }

    if (item_id) {
      const { data: itemPedido } = await supabase
        .from('pedido_items')
        .select('id, pedido_id')
        .eq('id', item_id)
        .single()

      if (itemPedido?.pedido_id) {
        const { data: pedidoActual } = await supabase
          .from('pedidos')
          .select('id, estado, cocinero_id')
          .eq('id', itemPedido.pedido_id)
          .eq('tenant_id', user.tenantId)
          .single()

        if (pedidoActual) {
          const esAdmin = user.rol === 'dueno' || user.rol === 'gerente'
          const tomadoPorMi = pedidoActual.cocinero_id === user.userId
          const sinAsignar = !pedidoActual.cocinero_id

          if (!sinAsignar && !tomadoPorMi && !esAdmin) {
            return NextResponse.json(
              { error: 'Solo el cocinero asignado puede marcar items de este pedido' },
              { status: 403 }
            )
          }
        }
      }

      const { error: itemError } = await supabase
        .from('pedido_items')
        .update({ estado: 'listo' })
        .eq('id', item_id)

      if (itemError) throw itemError

      const { data: items } = await supabase
        .from('pedido_items')
        .select('estado')
        .eq('pedido_id', pedido_id || itemPedido?.pedido_id)

      const todosListos = items?.every(i => i.estado === 'listo')

      if (todosListos) {
        await supabase
          .from('pedidos')
          .update({
            estado: 'listo',
            fecha_listo: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
          })
          .eq('id', pedido_id || itemPedido?.pedido_id)
          .eq('tenant_id', user.tenantId)
      }

      return NextResponse.json({ success: true, message: 'Item marcado como listo' })
    }

    if (pedido_id) {
      await supabase
        .from('pedido_items')
        .update({ estado: 'listo' })
        .eq('pedido_id', pedido_id)
        .in('estado', ['pendiente', 'en_preparacion'])

      await supabase
        .from('pedidos')
        .update({
          estado: 'listo',
          fecha_listo: new Date().toISOString(),
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
