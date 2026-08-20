// app/api/pedidos/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

const IVA = 0.16

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const mesaId = searchParams.get('mesa_id')
    const activos = searchParams.get('activos') === 'true'

    let query = supabase
      .from('pedidos')
      .select(`
        *,
        mesas!mesa_id (nombre),
        usuarios!mesero_id (nombre)
      `)
      .eq('tenant_id', user.tenantId)

    if (activos) {
      query = query.neq('estado', 'pagado').neq('estado', 'cancelado')
    } else if (estado) {
      query = query.eq('estado', estado)
    }

    if (mesaId) query = query.eq('mesa_id', mesaId)

    const { data: pedidos } = await query.order('fecha_creacion', { ascending: false })

    // Obtener items para cada pedido
    const pedidosConItems = await Promise.all((pedidos || []).map(async (p) => {
      const { data: items } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', p.id)

      return {
        ...p,
        mesa_nombre: p.mesas?.nombre || null,
        mesero_nombre: p.usuarios?.nombre || null,
        items: items || [],
        mesas: undefined,
        usuarios: undefined,
      }
    }))

    return NextResponse.json({ success: true, pedidos: pedidosConItems })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { mesa_id, items, mesero_id, notas } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items requeridos' }, { status: 400 })
    }

    if (!mesa_id) {
      return NextResponse.json({ error: 'Mesa requerida' }, { status: 400 })
    }

    // Verificar que la mesa existe
    const { data: mesa } = await supabase
      .from('mesas')
      .select('id')
      .eq('id', mesa_id)
      .eq('tenant_id', user.tenantId)
      .single()

    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    // Calcular subtotal
    let subtotal = 0
    const itemsData: any[] = []

    for (const item of items) {
      const { data: producto } = await supabase
        .from('productos')
        .select('nombre, precio')
        .eq('id', item.producto_id)
        .eq('tenant_id', user.tenantId)
        .single()

      if (!producto) {
        return NextResponse.json(
          { error: `Producto no encontrado: ${item.producto_id}` },
          { status: 404 }
        )
      }

      const precio = item.precio || producto.precio
      const cantidad = item.cantidad || 1
      const itemSubtotal = precio * cantidad
      subtotal += itemSubtotal

      itemsData.push({
        producto_id: item.producto_id,
        nombre_producto: producto.nombre,
        precio_unitario: precio,
        cantidad: cantidad,
        subtotal: itemSubtotal,
        notas: item.nota || null,
        estado: 'en_cocina',
      })
    }

    const impuestos = subtotal * IVA
    const total = subtotal + impuestos

    // Crear pedido directamente en estado en_cocina
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        tenant_id: user.tenantId,
        sucursal_id: user.sucursalId,
        mesa_id: mesa_id,
        usuario_id: user.userId,
        mesero_id: mesero_id || user.userId,
        subtotal: subtotal,
        impuestos: impuestos,
        total: total,
        estado: 'en_cocina',
        notas: notas || null,
        hora_apertura: new Date().toISOString(),
      })
      .select()
      .single()

    if (pedidoError) throw pedidoError

    // Crear items
    const itemsConPedido = itemsData.map(item => ({
      ...item,
      pedido_id: pedido.id,
    }))

    const { data: createdItems } = await supabase
      .from('pedido_items')
      .insert(itemsConPedido)
      .select()

    // Actualizar estado de la mesa a ocupada
    await supabase
      .from('mesas')
      .update({ estado: 'ocupada', fecha_actualizacion: new Date().toISOString() })
      .eq('id', mesa_id)

    return NextResponse.json({
      success: true,
      pedido: { ...pedido, items: createdItems || [] }
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const body = await req.json()
    const { estado, metodo_pago, propina, descuento, notas } = body

    if (!estado) {
      return NextResponse.json({ error: 'Estado requerido' }, { status: 400 })
    }

    // Verificar pedido
    const { data: pedidoActual } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single()

    if (!pedidoActual) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    const updates: Record<string, any> = {
      estado: estado,
      fecha_actualizacion: new Date().toISOString(),
    }

    if (metodo_pago !== undefined) updates.metodo_pago = metodo_pago
    if (propina !== undefined) updates.propina = propina
    if (descuento !== undefined) updates.descuento = descuento
    if (notas !== undefined) updates.notas = notas

    if (estado === 'pagado') {
      updates.hora_cierre = new Date().toISOString()
    }

    // Si se cobra, actualizar items a listo
    if (estado === 'pagado') {
      await supabase
        .from('pedido_items')
        .update({ estado: 'listo' })
        .eq('pedido_id', id)

      // Descontar inventario si existen recetas asociadas
      const { data: items } = await supabase
        .from('pedido_items')
        .select('producto_id, cantidad')
        .eq('pedido_id', id)

      for (const item of (items || [])) {
        const { data: recetas } = await supabase
          .from('recetas')
          .select('id, receta_items(insumo_id, cantidad)')
          .eq('producto_id', item.producto_id)
          .eq('tenant_id', user.tenantId)

        for (const r of (recetas || [])) {
          for (const ri of (r.receta_items || [])) {
            const totalUso = ri.cantidad * item.cantidad
            const { data: insumo } = await supabase
              .from('insumos')
              .select('stock')
              .eq('id', ri.insumo_id)
              .single()
            
            if (insumo) {
              const nuevoStock = Math.max(0, (insumo.stock || 0) - totalUso)
              await supabase
                .from('insumos')
                .update({ stock: nuevoStock, fecha_actualizacion: new Date().toISOString() })
                .eq('id', ri.insumo_id)
            }
          }
        }
      }
    }

    // Si se envía a cocina
    if (estado === 'en_cocina') {
      await supabase
        .from('pedido_items')
        .update({ estado: 'en_cocina' })
        .eq('pedido_id', id)
        .eq('estado', 'pendiente')
    }

    const { data: pedido, error: updateError } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError

    // Si el pedido se paga o cancela, liberar mesa
    if (['pagado', 'cancelado'].includes(estado) && pedidoActual.mesa_id) {
      await supabase
        .from('mesas')
        .update({ estado: 'libre', fecha_actualizacion: new Date().toISOString() })
        .eq('id', pedidoActual.mesa_id)
    }

    return NextResponse.json({ success: true, pedido })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}