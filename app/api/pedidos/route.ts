// app/api/pedidos/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'
import { descontarInsumosPorPedido, revertirDescuentoInsumos, validarStockPedido } from '@/lib/inventario'

const IVA = 0.16

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const mesaId = searchParams.get('mesa_id')
    const activos = searchParams.get('activos') === 'true'
    const limitRaw = searchParams.get('limit')
    const limit = limitRaw ? parseInt(limitRaw, 10) : null

    let query = supabase
      .from('pedidos')
      .select(`
        *,
        mesas!mesa_id (nombre),
        usuarios!mesero_id (nombre),
        cocinero:usuarios!cocinero_id (nombre)
      `)
      .eq('tenant_id', user.tenantId)

    if (activos) {
      query = query.not('estado', 'in', '(pagado,cancelado,entregado)')
    } else if (estado === 'historial_hoy') {
      const hoy = new Date().toISOString().split('T')[0]
      query = query
        .gte('fecha_creacion', hoy)
        .neq('estado', 'cancelado')
    } else if (estado) {
      const estadosLista = estado.split(',').map(s => s.trim()).filter(Boolean)
      if (estadosLista.length > 1) {
        query = query.in('estado', estadosLista)
      } else {
        query = query.eq('estado', estado)
      }
    }

    if (mesaId) query = query.eq('mesa_id', mesaId)

    let pedidosQuery = query.order('fecha_creacion', { ascending: false })
    if (limit) pedidosQuery = pedidosQuery.limit(limit)
    const { data: pedidos } = await pedidosQuery

    const pedidosConItems = await Promise.all((pedidos || []).map(async (p) => {
      const { data: items } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', p.id)

      return {
        ...p,
        mesa_nombre: p.mesas?.nombre || null,
        mesero_nombre: p.usuarios?.nombre || null,
        cocinero_nombre: (p as any).cocinero?.nombre || null,
        items: items || [],
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

    const { count, error: countError } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId)
      .gte('fecha_creacion', new Date().toISOString().split('T')[0])

    if (countError) throw countError
    const numeroPedido = (count ?? 0) + 1

    const estadoInicial = es_qr ? 'pendiente_pago' : 'en_espera_cocina'

    let meseroAsignado = mesero_id || user.userId
    if (es_qr) {
      const { data: asignacion } = await supabase
        .from('asignaciones_mesa')
        .select('usuario_id')
        .eq('mesa_id', mesa_id)
        .eq('activa', true)
        .eq('tenant_id', user.tenantId)
        .maybeSingle()

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
        estado: estadoInicial === 'pendiente_pago' ? 'pendiente_pago' : 'pendiente',
      })
    }

    const impuestos = subtotal * IVA
    const total = subtotal + impuestos

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
        numero_pedido: numeroPedido,
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

    if (estadoInicial === 'en_preparacion') {
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
    const {
      estado,
      metodo_pago,
      propina,
      descuento,
      notas,
      tiempo_estimado,
      accion,
      motivo,
    } = body

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

    if (tiempo_estimado !== undefined) updates.tiempo_estimado = tiempo_estimado
    if (metodo_pago !== undefined) updates.metodo_pago = metodo_pago
    if (propina !== undefined) updates.propina = propina
    if (descuento !== undefined) updates.descuento = descuento
    if (notas !== undefined) updates.notas = notas

    let descontarInsumos = false
    let liberarMesa = false
    let revertirInsumos = false
    let actualizarItemsAPendiente = false

    if (accion === 'tomar_preparacion') {
      if (!['en_cocina', 'en_espera_cocina'].includes(pedidoActual.estado)) {
        return NextResponse.json(
          { error: 'El pedido no está disponible para tomar' },
          { status: 409 }
        )
      }
      updates.estado = 'en_preparacion'
      updates.cocinero_id = user.userId
      updates.fecha_tomado = new Date().toISOString()
    } else if (accion === 'liberar_pedido') {
      if (pedidoActual.cocinero_id !== user.userId && user.rol !== 'dueno' && user.rol !== 'gerente') {
        return NextResponse.json(
          { error: 'No puedes liberar un pedido tomado por otro cocinero' },
          { status: 403 }
        )
      }
      updates.estado = 'en_espera_cocina'
      updates.cocinero_id = null
      updates.fecha_tomado = null
    } else if (estado) {
      if (estado === 'pagado' && pedidoActual.estado === 'pendiente_pago') {
        const valStock = await validarStockPedido(
          user.tenantId!,
          (pedidoActual.pedido_items || []).map((it: any) => ({
            producto_id: it.producto_id,
            cantidad: it.cantidad,
          }))
        )
        if (!valStock.success) {
          return NextResponse.json(
            { error: `Stock insuficiente: ${valStock.error}` },
            { status: 409 }
          )
        }
        updates.estado = 'en_espera_cocina'
        updates.hora_apertura = pedidoActual.hora_apertura || new Date().toISOString()
        descontarInsumos = true
        actualizarItemsAPendiente = true
      } else if (estado === 'listo' && ['en_cocina', 'en_preparacion', 'en_espera_cocina'].includes(pedidoActual.estado)) {
        updates.estado = 'listo'
        updates.fecha_listo = new Date().toISOString()
      } else if (estado === 'entregado' && pedidoActual.estado === 'listo') {
        updates.estado = 'entregado'
        updates.fecha_entrega = new Date().toISOString()
        if (pedidoActual.es_qr) {
          liberarMesa = true
          updates.hora_cierre = new Date().toISOString()
        }
      } else if (estado === 'pagado' && pedidoActual.estado === 'listo') {
        updates.estado = 'pagado'
        updates.hora_cierre = new Date().toISOString()
        liberarMesa = true
      } else if (estado === 'cancelado' && pedidoActual.estado !== 'cancelado') {
        updates.estado = 'cancelado'
        updates.motivo_cancelacion = motivo || 'Cancelado por usuario'
        if (!['pendiente_pago'].includes(pedidoActual.estado)) {
          revertirInsumos = true
        }
        liberarMesa = true
      } else if (estado === 'pagado' && pedidoActual.estado === 'entregado') {
        updates.estado = 'pagado'
        updates.hora_cierre = new Date().toISOString()
      } else {
        updates.estado = estado
      }
    }

    if (descontarInsumos) {
      const items = pedidoActual.pedido_items || []
      const resultadoDescuento = await descontarInsumosPorPedido(
        user.tenantId!,
        user.userId,
        id,
        items.map((item: any) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
        }))
      )
      if (!resultadoDescuento.success) {
        return NextResponse.json(
          { error: `No hay suficientes insumos: ${resultadoDescuento.error}` },
          { status: 409 }
        )
      }
    }

    if (revertirInsumos) {
      const items = pedidoActual.pedido_items || []
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

    const { data: pedido, error: updateError } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError

    if (actualizarItemsAPendiente) {
      await supabase
        .from('pedido_items')
        .update({ estado: 'pendiente' })
        .eq('pedido_id', id)
        .eq('estado', 'pendiente_pago')
    }

    if (liberarMesa && pedidoActual.mesa_id) {
      await supabase
        .from('mesas')
        .update({ estado: 'libre', mesero_id: null, fecha_actualizacion: new Date().toISOString() })
        .eq('id', pedidoActual.mesa_id)

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
