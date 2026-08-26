import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { descontarInsumosPorPedido, revertirDescuentoInsumos, validarStockPedido } from '@/lib/inventario'
import {
  pedidoConItems,
  resolverMesaPublica,
  usuarioParaPedidoQr,
} from '@/lib/cliente-publico'

const IVA = 0.16
const ESTADOS_ACTIVOS = [
  'pendiente_pago',
  'en_espera_cocina',
  'en_cocina',
  'en_preparacion',
  'listo',
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pedidoId = searchParams.get('id')
    const mesa = await resolverMesaPublica(
      searchParams.get('mesa'),
      searchParams.get('mid') || searchParams.get('mesa_id'),
    )

    if (pedidoId) {
      const detalle = await pedidoConItems(pedidoId)
      if (!detalle) {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      }
      if (mesa && detalle.mesa_id !== mesa.id) {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      }
      return NextResponse.json({ success: true, pedido: detalle, pedidos: [detalle] })
    }

    if (!mesa) {
      return NextResponse.json({ error: 'Mesa requerida' }, { status: 400 })
    }

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('*')
      .eq('mesa_id', mesa.id)
      .eq('tenant_id', mesa.tenant_id)
      .eq('es_qr', true)
      .in('estado', ESTADOS_ACTIVOS)
      .order('fecha_creacion', { ascending: false })

    const conItems = await Promise.all(
      (pedidos || []).map(async (p) => (await pedidoConItems(p.id)) || p),
    )

    return NextResponse.json({ success: true, pedidos: conItems })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, metodo_pago, notas } = body

    const mesa = await resolverMesaPublica(body.mesa || null, body.mesa_id || body.mid || null)
    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada. Escanea el QR de nuevo.' }, { status: 404 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items requeridos' }, { status: 400 })
    }

    const usuarioId = await usuarioParaPedidoQr(mesa.tenant_id, mesa.id)
    if (!usuarioId) {
      return NextResponse.json(
        { error: 'El restaurante no tiene personal configurado para recibir pedidos QR' },
        { status: 409 },
      )
    }

    const valStock = await validarStockPedido(
      mesa.tenant_id,
      items.map((it: any) => ({
        producto_id: it.producto_id,
        cantidad: it.cantidad || 1,
      })),
    )
    if (!valStock.success) {
      return NextResponse.json(
        { error: `Stock insuficiente: ${valStock.error}` },
        { status: 409 },
      )
    }

    const { count, error: countError } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', mesa.tenant_id)
      .gte('fecha_creacion', new Date().toISOString().split('T')[0])

    if (countError) throw countError
    const numeroPedido = (count ?? 0) + 1

    let subtotal = 0
    const itemsData: any[] = []

    for (const item of items) {
      const { data: producto } = await supabase
        .from('productos')
        .select('nombre, precio, stock')
        .eq('id', item.producto_id)
        .eq('tenant_id', mesa.tenant_id)
        .single()

      if (!producto) {
        return NextResponse.json(
          { error: `Producto no encontrado: ${item.producto_id}` },
          { status: 404 },
        )
      }

      if (producto.stock !== null && producto.stock < (item.cantidad || 1)) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}` },
          { status: 409 },
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
        cantidad,
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
        tenant_id: mesa.tenant_id,
        sucursal_id: mesa.sucursal_id,
        mesa_id: mesa.id,
        usuario_id: usuarioId,
        mesero_id: usuarioId,
        subtotal,
        impuestos,
        total,
        estado: 'en_espera_cocina',
        notas: notas || null,
        hora_apertura: new Date().toISOString(),
        es_qr: true,
        tiempo_estimado: 10,
        numero_pedido: numeroPedido,
        metodo_pago: metodo_pago || 'simulado',
      })
      .select()
      .single()

    if (pedidoError) throw pedidoError

    const { data: createdItems, error: itemsError } = await supabase
      .from('pedido_items')
      .insert(itemsData.map((item) => ({ ...item, pedido_id: pedido.id })))
      .select()

    if (itemsError) {
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      throw itemsError
    }

    const resultadoDescuento = await descontarInsumosPorPedido(
      mesa.tenant_id,
      usuarioId,
      pedido.id,
      items.map((item: any) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad || 1,
      })),
    )

    if (!resultadoDescuento.success) {
      await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      return NextResponse.json(
        { error: `No hay suficientes insumos: ${resultadoDescuento.error}` },
        { status: 409 },
      )
    }

    await supabase
      .from('mesas')
      .update({ estado: 'ocupada', fecha_actualizacion: new Date().toISOString() })
      .eq('id', mesa.id)

    const detalle = await pedidoConItems(pedido.id)
    const pedidoRespuesta = detalle || {
      ...pedido,
      mesa_nombre: mesa.nombre,
      cocinero_nombre: null,
      items: createdItems || [],
    }
    return NextResponse.json({ success: true, pedido: pedidoRespuesta }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const body = await req.json()
    const { data: pedidoActual } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .eq('es_qr', true)
      .single()

    if (!pedidoActual) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    if (body.estado === 'cancelado') {
      if (!['pendiente_pago', 'en_espera_cocina'].includes(pedidoActual.estado)) {
        return NextResponse.json(
          { error: 'Este pedido ya no se puede cancelar' },
          { status: 409 },
        )
      }

      const { data: items } = await supabase
        .from('pedido_items')
        .select('producto_id, cantidad')
        .eq('pedido_id', id)

      if (pedidoActual.estado !== 'pendiente_pago') {
        await revertirDescuentoInsumos(
          pedidoActual.tenant_id,
          pedidoActual.usuario_id,
          id,
          (items || []).map((it: any) => ({
            producto_id: it.producto_id,
            cantidad: it.cantidad,
          })),
        )
      }

      await supabase
        .from('pedidos')
        .update({
          estado: 'cancelado',
          motivo_cancelacion: body.motivo || 'Cancelado por cliente',
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', id)

      if (pedidoActual.mesa_id) {
        await supabase
          .from('mesas')
          .update({ estado: 'libre', fecha_actualizacion: new Date().toISOString() })
          .eq('id', pedidoActual.mesa_id)
      }

      const detalle = await pedidoConItems(id)
      return NextResponse.json({ success: true, pedido: detalle })
    }

    return NextResponse.json({ error: 'Operación no permitida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
