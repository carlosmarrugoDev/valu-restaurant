import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .in('estado', ['en_cocina', 'en_espera_cocina', 'en_preparacion', 'listo'])
      .order('fecha_creacion', { ascending: true })

    const mesaIds = [...new Set((pedidos || []).map((p: any) => p.mesa_id).filter(Boolean))]
    const meseroIds = [...new Set((pedidos || []).map((p: any) => p.mesero_id).filter(Boolean))]
    const cocineroIds = [...new Set((pedidos || []).map((p: any) => p.cocinero_id).filter(Boolean))]
    const todosUserIds = [...new Set([...meseroIds, ...cocineroIds])]

    const { data: mesasMap } = mesaIds.length > 0
      ? await supabase.from('mesas').select('id, nombre').in('id', mesaIds)
      : { data: [] }
    const { data: usuariosMap } = todosUserIds.length > 0
      ? await supabase.from('usuarios').select('id, nombre').in('id', todosUserIds)
      : { data: [] }

    const mesasDict: Record<string, string> = {}
    const usuariosDict: Record<string, string> = {}
    ;(mesasMap || []).forEach((m: any) => { mesasDict[m.id] = m.nombre })
    ;(usuariosMap || []).forEach((u: any) => { usuariosDict[u.id] = u.nombre })

    const pedidosConItems = await Promise.all((pedidos || []).map(async (p: any) => {
      const { data: items } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', p.id)
        .in('estado', ['pendiente_pago', 'pendiente', 'en_cocina', 'en_preparacion', 'listo'])

      const segundosTranscurridos = p.fecha_creacion
        ? Math.floor((Date.now() - new Date(p.fecha_creacion).getTime()) / 1000)
        : 0

      return {
        ...p,
        mesa_nombre: mesasDict[p.mesa_id] || null,
        mesero_nombre: p.mesero_id ? (usuariosDict[p.mesero_id] || null) : null,
        cocinero_nombre: p.cocinero_id ? (usuariosDict[p.cocinero_id] || null) : null,
        items: items || [],
        segundos_transcurridos: segundosTranscurridos,
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
        .in('estado', ['pendiente_pago', 'pendiente', 'en_cocina', 'en_preparacion'])

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
