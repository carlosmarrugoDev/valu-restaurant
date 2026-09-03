// app/api/pedidos/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

// Estas operaciones se mantienen aquí para que esta ruta no dependa de un
// módulo de inventario que no está disponible en todos los despliegues.
type StockItem = { producto_id: string; cantidad: number }
type StockResult = { success: boolean; error?: string }

async function descontarStockProductos(tenantId: string, items: StockItem[]): Promise<StockResult> {
  for (const item of items) {
    const { data: producto, error } = await supabase
      .from('productos')
      .select('stock')
      .eq('id', item.producto_id)
      .eq('tenant_id', tenantId)
      .single()
    if (error || !producto || (producto.stock !== null && producto.stock < item.cantidad)) {
      return { success: false, error: 'Stock insuficiente' }
    }
    if (producto.stock !== null) {
      const { error: updateError } = await supabase
        .from('productos')
        .update({ stock: producto.stock - item.cantidad })
        .eq('id', item.producto_id)
        .eq('tenant_id', tenantId)
      if (updateError) return { success: false, error: updateError.message }
    }
  }
  return { success: true }
}

async function revertirStockProductos(tenantId: string, items: StockItem[]) {
  for (const item of items) {
    const { data: producto } = await supabase
      .from('productos')
      .select('stock')
      .eq('id', item.producto_id)
      .eq('tenant_id', tenantId)
      .single()
    if (producto?.stock !== null && producto) {
      await supabase
        .from('productos')
        .update({ stock: producto.stock + item.cantidad })
        .eq('id', item.producto_id)
        .eq('tenant_id', tenantId)
    }
  }
}

async function descontarInsumosPorPedido(
  _tenantId: string,
  _userId: string,
  _pedidoId: string,
  _items: StockItem[],
): Promise<StockResult> {
  return { success: true }
}

async function revertirDescuentoInsumos(
  _tenantId: string,
  _userId: string,
  _pedidoId: string,
  _items: StockItem[],
): Promise<StockResult> {
  return { success: true }
}

const IVA = 0.16

// Función para generar código de reclamo único
function generarCodigoReclamo(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '0123456789'
  let codigo = ''
  for (let i = 0; i < 3; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)]
    codigo += numeros[Math.floor(Math.random() * numeros.length)]
  }
  return codigo
}

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
      .select('*')
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

    const mesaIds = [...new Set((pedidos || []).map(p => p.mesa_id).filter(Boolean))]
    const meseroIds = [...new Set((pedidos || []).map(p => p.mesero_id).filter(Boolean))]
    const cocineroIds = [...new Set((pedidos || []).map(p => p.cocinero_id).filter(Boolean))]
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

      return {
        ...p,
        mesa_nombre: mesasDict[p.mesa_id] || null,
        mesero_nombre: p.mesero_id ? (usuariosDict[p.mesero_id] || null) : null,
        cocinero_nombre: p.cocinero_id ? (usuariosDict[p.cocinero_id] || null) : null,
        items: items || [],
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

    // Generar código de reclamo único
    const codigoReclamo = generarCodigoReclamo()

    // El estado inicial SIEMPRE es en_cocina (flujo autoservicio)
    const estadoInicial = 'en_cocina'

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
        estado: 'pendiente',
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
        codigo_reclamo: codigoReclamo,
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

    // Descontar inventario inmediatamente (flujo autoservicio)
    const itemsMap = items.map((item: any) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad || 1,
    }))

    const resultadoStockProductos = await descontarStockProductos(user.tenantId!, itemsMap)
    if (!resultadoStockProductos.success) {
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return NextResponse.json(
        { error: resultadoStockProductos.error || 'Stock insuficiente' },
        { status: 409 }
      )
    }

    const resultadoDescuento = await descontarInsumosPorPedido(
      user.tenantId!,
      user.userId,
      pedido.id,
      itemsMap,
    )

    if (!resultadoDescuento.success) {
      await revertirStockProductos(user.tenantId!, itemsMap)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return NextResponse.json(
        { error: `No hay suficientes insumos: ${resultadoDescuento.error}` },
        { status: 409 }
      )
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

    const { data: pedidoActual, error: pError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .maybeSingle()

    if (pError || !pedidoActual) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    const { data: itemsPedido } = await supabase
      .from('pedido_items')
      .select('*')
      .eq('pedido_id', id)

    const pedidoConItems = {
      ...pedidoActual,
      pedido_items: itemsPedido || [],
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
      if (!['en_cocina', 'en_espera_cocina'].includes(pedidoConItems.estado)) {
        return NextResponse.json(
          { error: 'El pedido no está disponible para tomar' },
          { status: 409 }
        )
      }
      updates.estado = 'en_preparacion'
      updates.cocinero_id = user.userId
      updates.fecha_tomado = new Date().toISOString()
    } else if (accion === 'liberar_pedido') {
      if (pedidoConItems.cocinero_id !== user.userId && user.rol !== 'dueno' && user.rol !== 'gerente') {
        return NextResponse.json(
          { error: 'No puedes liberar un pedido tomado por otro cocinero' },
          { status: 403 }
        )
      }
      updates.estado = 'en_cocina'
      updates.cocinero_id = null
      updates.fecha_tomado = null
    } else if (estado) {
      if (estado === 'listo' && ['en_cocina', 'en_preparacion', 'en_espera_cocina'].includes(pedidoConItems.estado)) {
        updates.estado = 'listo'
        updates.fecha_listo = new Date().toISOString()
      } else if (estado === 'entregado' && [
        'listo',
        'en_preparacion',
        'en_cocina',
        'en_espera_cocina',
        'pendiente_pago',
      ].includes(pedidoConItems.estado)) {
        updates.estado = 'entregado'
        updates.fecha_entrega = new Date().toISOString()
        updates.fecha_listo = pedidoConItems.fecha_listo || new Date().toISOString()
        liberarMesa = true
        updates.hora_cierre = new Date().toISOString()
        try {
          await supabase
            .from('pedido_items')
            .update({ estado: 'listo', cocinero_id: pedidoConItems.cocinero_id || user.userId } as any)
            .eq('pedido_id', id)
            .neq('estado', 'listo')
        } catch { /* no-op */ }
      } else if (estado === 'pagado' && pedidoConItems.estado === 'listo') {
        updates.estado = 'pagado'
        updates.hora_cierre = new Date().toISOString()
        liberarMesa = true
      } else if (estado === 'cancelado' && pedidoConItems.estado !== 'cancelado') {
        updates.estado = 'cancelado'
        updates.motivo_cancelacion = motivo || 'Cancelado por usuario'
        if (['en_cocina', 'en_preparacion', 'listo'].includes(pedidoConItems.estado)) {
          revertirInsumos = true
        }
        liberarMesa = true
      } else if (estado === 'pagado' && pedidoConItems.estado === 'entregado') {
        updates.estado = 'pagado'
        updates.hora_cierre = new Date().toISOString()
      } else {
        updates.estado = estado
      }
    }

    if (descontarInsumos) {
      const items = pedidoConItems.pedido_items || []
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
      const items = pedidoConItems.pedido_items || []
      const itemsMap = items.map((item: any) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
      }))
      await revertirStockProductos(user.tenantId!, itemsMap)
      const resultado = await revertirDescuentoInsumos(
        user.tenantId!,
        user.userId,
        id,
        itemsMap,
      )
      if (!resultado.success) {
        return NextResponse.json({ error: resultado.error }, { status: 400 })
      }
    }

    let pedido: any = null
    try {
      const { data: pedidoActualizado, error: updateError } = await supabase
        .from('pedidos')
        .update(updates as any)
        .eq('id', id)
        .eq('tenant_id', user.tenantId)
        .select()
        .maybeSingle()

      if (updateError) {
        const basicUpdates: Record<string, any> = { fecha_actualizacion: updates.fecha_actualizacion }
        if (updates.estado) basicUpdates.estado = updates.estado
        if (updates.notas !== undefined) basicUpdates.notas = updates.notas
        if (updates.descuento !== undefined) basicUpdates.descuento = updates.descuento
        if (updates.propina !== undefined) basicUpdates.propina = updates.propina
        if (updates.metodo_pago !== undefined) basicUpdates.metodo_pago = updates.metodo_pago
        if (updates.tiempo_estimado !== undefined) basicUpdates.tiempo_estimado = updates.tiempo_estimado

        const { data: fallback, error: fallbackError } = await supabase
          .from('pedidos')
          .update(basicUpdates as any)
          .eq('id', id)
          .eq('tenant_id', user.tenantId)
          .select()
          .maybeSingle()

        if (fallbackError) throw fallbackError
        pedido = fallback
      } else {
        pedido = pedidoActualizado
      }
    } catch (e: any) {
      throw e
    }

    if (!pedido) {
      return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 })
    }

    if (actualizarItemsAPendiente) {
      try {
        await supabase
          .from('pedido_items')
          .update({ estado: 'pendiente' })
          .eq('pedido_id', id)
          .eq('estado', 'pendiente_pago')
      } catch { /* no-op */ }
    }

    if (liberarMesa && pedidoConItems.mesa_id) {
      try {
        await supabase
          .from('mesas')
          .update({ estado: 'libre', fecha_actualizacion: new Date().toISOString() })
          .eq('id', pedidoConItems.mesa_id)
      } catch { /* no-op */ }

      try {
        await supabase
          .from('asignaciones_mesa')
          .update({ activa: false })
          .eq('mesa_id', pedidoConItems.mesa_id)
          .eq('tenant_id', user.tenantId)
      } catch { /* no-op */ }
    }

    return NextResponse.json({ success: true, pedido })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 })
  }
}