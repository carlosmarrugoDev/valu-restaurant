// app/api/pedidos/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'
import { descontarInsumosPorPedido, revertirDescuentoInsumos } from '@/lib/inventario'

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
    const { mesa_id, items, mesero_id, notas, es_qr } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items requeridos' }, { status: 400 })
    }

    if (!mesa_id) {
      return NextResponse.json({ error: 'Mesa requerida' }, { status: 400 })
    }

    const { data: mesa } = await supabase
      .from('mesas')
      .select('id')
      .eq('id', mesa_id)
      .eq('tenant_id', user.tenantId)
      .single()

    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    // Verificar si el tenant tiene QR directo o necesita confirmación
    const { data: tenant } = await supabase
      .from('tenants')
      .select('qr_confirmacion_directa')
      .eq('id', user.tenantId)
      .single()

    const estadoInicial = (es_qr && !tenant?.qr_confirmacion_directa) 
      ? 'pendiente_confirmacion' 
      : 'en_cocina'

    let meseroAsignado = mesero_id || user.userId
    if (es_qr && estadoInicial === 'pendiente_confirmacion') {
      const { data: asignacion } = await supabase
        .from('asignaciones_mesa')
        .select('usuario_id')
        .eq('mesa_id', mesa_id)
        .eq('activa', true)
        .eq('tenant_id', user.tenantId)
        .single()

      if (asignacion) {
        meseroAsignado = asignacion.usuario_id
      }
    }

    let subtotal = 0
    const itemsData: any[] = []

    for (const item of items) {
      const { data: producto } = await supabase
        .from('productos')
        .select('nombre, precio, stock')
        .eq('id', item.producto_id)
        .eq('tenant_id', user.tenantId)
        .single()

      if (!producto) {
        return NextResponse.json(
          { error: `Producto no encontrado: ${item.producto_id}` },
          { status: 404 }
        )
      }

      // Verificar stock de producto directo
      if (producto.stock !== null && producto.stock < (item.cantidad || 1)) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}` },
          { status: 409 }
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

    // Crear pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        tenant_id: user.tenantId,
        sucursal_id: user.sucursalId,
        mesa_id: mesa_id,
        usuario_id: user.userId,
        mesero_id: meseroAsignado,
        subtotal: subtotal,
        impuestos: impuestos,
        total: total,
        estado: estadoInicial,
        notas: notas || null,
        hora_apertura: new Date().toISOString(),
        es_qr: es_qr || false,
        tiempo_estimado: 10,
      })
      .select()
      .single()

    if (pedidoError) throw pedidoError

    const itemsConPedido = itemsData.map(item => ({
      ...item,
      pedido_id: pedido.id,
    }))

    const { data: createdItems } = await supabase
      .from('pedido_items')
      .insert(itemsConPedido)
      .select()

    // Si es confirmación directa o es mesero, descontar insumos
    if (estadoInicial === 'en_cocina') {
      const resultadoDescuento = await descontarInsumosPorPedido(
        user.tenantId!,
        user.userId,
        pedido.id,
        items.map((item: any) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad || 1,
        }))
      )

      if (!resultadoDescuento.success) {
        // Revertir pedido si falla el descuento
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        return NextResponse.json(
          { error: `No hay suficientes insumos: ${resultadoDescuento.error}` },
          { status: 409 }
        )
      }
    }

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
    const { estado, metodo_pago, propina, descuento, notas, tiempo_estimado } = body

    if (!estado && tiempo_estimado === undefined) {
      return NextResponse.json({ error: 'Estado o tiempo_estimado requerido' }, { status: 400 })
    }

    const { data: pedidoActual } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*)')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single()

    if (!pedidoActual) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    const updates: Record<string, any> = {
      fecha_actualizacion: new Date().toISOString(),
    }

    if (estado) updates.estado = estado
    if (tiempo_estimado !== undefined) updates.tiempo_estimado = tiempo_estimado
    if (metodo_pago !== undefined) updates.metodo_pago = metodo_pago
    if (propina !== undefined) updates.propina = propina
    if (descuento !== undefined) updates.descuento = descuento
    if (notas !== undefined) updates.notas = notas

    if (estado === 'pagado') {
      updates.hora_cierre = new Date().toISOString()
    }

    // Si se envía a cocina (confirmación QR)
    if (estado === 'en_cocina' && pedidoActual.estado === 'pendiente_confirmacion') {
      // Validar stock antes de confirmar
      const items = pedidoActual.pedido_items || []
      const resultado = await descontarInsumosPorPedido(
        user.tenantId!,
        user.userId,
        id,
        items.map((item: any) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
        }))
      )

      if (!resultado.success) {
        return NextResponse.json(
          { error: `No hay suficientes insumos: ${resultado.error}` },
          { status: 409 }
        )
      }

      await supabase
        .from('pedido_items')
        .update({ estado: 'en_cocina' })
        .eq('pedido_id', id)
    }

    // Si se cancela, registrar motivo y revertir stock
    if (estado === 'cancelado' && pedidoActual.estado !== 'cancelado') {
      const items = pedidoActual.pedido_items || []
      
      // Solo revertir si ya se había descontado (estaba en cocina o pagado)
      if (pedidoActual.estado !== 'pendiente_confirmacion') {
        const resultado = await revertirDescuentoInsumos(
          user.tenantId!,
          user.userId,
          id,
          items.map((item: any) => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
          }))
        )

        if (!resultado.success) {
          return NextResponse.json({ error: resultado.error }, { status: 400 })
        }
      }
      
      updates.motivo_cancelacion = body.motivo || 'Cancelado por usuario'
    }

    const { data: pedido, error: updateError } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError

    if (['pagado', 'cancelado'].includes(estado) && pedidoActual.mesa_id) {
      // Liberar mesa
      await supabase
        .from('mesas')
        .update({ estado: 'libre', mesero_id: null, fecha_actualizacion: new Date().toISOString() })
        .eq('id', pedidoActual.mesa_id)
      
      // Desactivar asignación de mesero
      await supabase
        .from('asignaciones_mesa')
        .update({ activa: false })
        .eq('mesa_id', pedidoActual.mesa_id)
        .eq('tenant_id', user.tenantId)
    }

    return NextResponse.json({ success: true, pedido })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}