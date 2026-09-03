// app/api/pedidos/unir/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { pedido_ids, mesa_destino_id } = body

    if (!pedido_ids || !Array.isArray(pedido_ids) || pedido_ids.length < 2) {
      return NextResponse.json({ error: 'Se necesitan al menos 2 pedidos para unir' }, { status: 400 })
    }

    if (!mesa_destino_id) {
      return NextResponse.json({ error: 'Mesa destino requerida' }, { status: 400 })
    }

    let subtotalTotal = 0
    let impuestosTotal = 0
    let totalItems = 0
    const todosItems: any[] = []
    const pedidosOriginales = pedido_ids.length // <-- CORREGIDO: definir la variable

    // Obtener todos los pedidos
    for (const pedidoId of pedido_ids) {
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*, pedido_items (*)')
        .eq('id', pedidoId)
        .eq('tenant_id', user.tenantId)
        .single()

      if (pedidoError || !pedido) {
        return NextResponse.json({ error: `Pedido ${pedidoId} no encontrado` }, { status: 404 })
      }

      subtotalTotal += pedido.subtotal || 0
      impuestosTotal += pedido.impuestos || 0
      totalItems += (pedido.pedido_items || []).length

      for (const item of (pedido.pedido_items || [])) {
        todosItems.push(item)
      }

      // Cancelar pedido original
      await supabase
        .from('pedidos')
        .update({ estado: 'cancelado', notas: `Unido con pedido ${pedido_ids.join(', ')}` })
        .eq('id', pedidoId)
    }

    // Crear pedido unificado
    const { data: pedidoUnificado, error: createError } = await supabase
      .from('pedidos')
      .insert({
        tenant_id: user.tenantId,
        sucursal_id: user.sucursalId,
        mesa_id: mesa_destino_id,
        usuario_id: user.userId,
        subtotal: subtotalTotal,
        impuestos: impuestosTotal,
        total: subtotalTotal + impuestosTotal,
        estado: 'en_cocina',
        notas: `Unión de ${pedidosOriginales} pedidos`, // <-- CORREGIDO: usar la variable
        hora_apertura: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) throw createError

    // Mover items al nuevo pedido
    for (const item of todosItems) {
      await supabase
        .from('pedido_items')
        .update({ pedido_id: pedidoUnificado.id })
        .eq('id', item.id)
    }

    // Liberar mesas originales
    for (const pedidoId of pedido_ids) {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('mesa_id')
        .eq('id', pedidoId)
        .single()

      if (pedido?.mesa_id) {
        await supabase
          .from('mesas')
          .update({ estado: 'libre' })
          .eq('id', pedido.mesa_id)
      }
    }

    // Ocupar mesa destino
    await supabase
      .from('mesas')
      .update({ estado: 'ocupada' })
      .eq('id', mesa_destino_id)

    return NextResponse.json({
      success: true,
      pedido: pedidoUnificado,
      message: `Se unieron ${pedidosOriginales} pedidos en una sola cuenta`,
      total_items: totalItems,
    })
  } catch (error: any) {
    console.error('Error uniendo pedidos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}