// app/api/pedidos/cancelar/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'
import { revertirDescuentoInsumos } from '@/lib/inventario'

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { pedido_id, motivo } = body

    if (!pedido_id) {
      return NextResponse.json({ error: 'Pedido ID requerido' }, { status: 400 })
    }

    // Obtener pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*, pedido_items (*)')
      .eq('id', pedido_id)
      .eq('tenant_id', user.tenantId)
      .single()

    if (pedidoError || !pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Si está en cocina o pendiente, revertir insumos
    if (pedido.estado === 'en_cocina' || pedido.estado === 'pendiente_confirmacion') {
      const items = pedido.pedido_items || []
      const resultado = await revertirDescuentoInsumos(
        user.tenantId!,
        user.userId,
        pedido_id,
        items.map((item: any) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
        }))
      )

      if (!resultado.success) {
        return NextResponse.json({ error: resultado.error }, { status: 400 })
      }
    }

    // Actualizar pedido
    const { data: pedidoActualizado, error: updateError } = await supabase
      .from('pedidos')
      .update({
        estado: 'cancelado',
        motivo_cancelacion: motivo || 'Cancelado por usuario',
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('id', pedido_id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError

    // Liberar mesa
    if (pedido.mesa_id) {
      await supabase
        .from('mesas')
        .update({ estado: 'libre', mesero_id: null })
        .eq('id', pedido.mesa_id)
    }

    return NextResponse.json({
      success: true,
      pedido: pedidoActualizado,
      message: 'Pedido cancelado correctamente',
    })
  } catch (error: any) {
    console.error('Error cancelando pedido:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}