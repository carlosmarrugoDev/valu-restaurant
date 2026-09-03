// app/api/pedidos/dividir/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { pedido_id, items_por_persona } = body

    if (!pedido_id || !items_por_persona || !Array.isArray(items_por_persona)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Obtener pedido original
    const { data: pedidoOriginal, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*, pedido_items (*)')
      .eq('id', pedido_id)
      .eq('tenant_id', user.tenantId)
      .single()

    if (pedidoError || !pedidoOriginal) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Crear pedidos divididos
    const nuevosPedidos = []
    for (const persona of items_por_persona) {
      const items = persona.items || []
      if (items.length === 0) continue

      let subtotal = 0
      const itemsData = []

      for (const item of items) {
        const itemData = pedidoOriginal.pedido_items.find((pi: any) => pi.id === item.id)
        if (!itemData) continue

        const precio = itemData.precio_unitario
        const cantidad = item.cantidad || 1
        const itemSubtotal = precio * cantidad
        subtotal += itemSubtotal

        itemsData.push({
          ...itemData,
          cantidad,
          subtotal: itemSubtotal,
        })
      }

      const impuestos = subtotal * 0.16
      const total = subtotal + impuestos

      const { data: nuevoPedido, error: createError } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: user.tenantId,
          sucursal_id: pedidoOriginal.sucursal_id,
          mesa_id: pedidoOriginal.mesa_id,
          usuario_id: user.userId,
          mesero_id: pedidoOriginal.mesero_id,
          subtotal,
          impuestos,
          total,
          estado: 'en_cocina',
          notas: persona.nombre ? `Cuenta de ${persona.nombre}` : `Dividido de pedido ${pedido_id}`,
          hora_apertura: new Date().toISOString(),
        })
        .select()
        .single()

      if (createError) throw createError

      // Insertar items
      for (const item of itemsData) {
        await supabase
          .from('pedido_items')
          .insert({
            ...item,
            pedido_id: nuevoPedido.id,
          })
      }

      nuevosPedidos.push(nuevoPedido)
    }

    // Cancelar pedido original
    await supabase
      .from('pedidos')
      .update({ 
        estado: 'cancelado', 
        notas: `Dividido en ${nuevosPedidos.length} pedidos` 
      })
      .eq('id', pedido_id)

    return NextResponse.json({
      success: true,
      pedidos: nuevosPedidos,
      message: `Pedido dividido en ${nuevosPedidos.length} cuentas`,
    })
  } catch (error: any) {
    console.error('Error dividiendo pedido:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}