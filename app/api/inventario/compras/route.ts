// app/api/inventario/compras/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'
import { registrarMovimiento } from '@/lib/inventario'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { data, error: queryError } = await supabase
      .from('compras_inventario')
      .select(`
        *,
        compra_items (
          *,
          insumos (nombre, unidad)
        ),
        usuarios (nombre)
      `)
      .eq('tenant_id', user.tenantId)
      .order('fecha_compra', { ascending: false })

    if (queryError) throw queryError

    return NextResponse.json({ success: true, compras: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { proveedor, items, notas } = body

    if (!proveedor || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Calcular total
    let total = 0
    const itemsData = items.map((item: any) => {
      const subtotal = item.cantidad * item.costo_unitario
      total += subtotal
      return {
        insumo_id: item.insumo_id,
        cantidad: item.cantidad,
        costo_unitario: item.costo_unitario,
        subtotal,
      }
    })

    // Crear compra
    const { data: compra, error: compraError } = await supabase
      .from('compras_inventario')
      .insert({
        tenant_id: user.tenantId,
        proveedor,
        total,
        notas: notas || null,
        usuario_id: user.userId,
      })
      .select()
      .single()

    if (compraError) throw compraError

    // Insertar items y registrar movimientos
    const movimientos = []
    for (const item of itemsData) {
      const { error: itemError } = await supabase
        .from('compra_items')
        .insert({
          compra_id: compra.id,
          ...item,
        })

      if (itemError) throw itemError

      const resultado = await registrarMovimiento(user.tenantId!, user.userId, {
        insumo_id: item.insumo_id,
        tipo: 'compra',
        cantidad: item.cantidad,
        costo_unitario: item.costo_unitario,
        motivo: `Compra: ${proveedor}`,
        referencia_id: compra.id,
      })

      if (!resultado.success) {
        return NextResponse.json({ error: resultado.error }, { status: 400 })
      }

      movimientos.push(resultado)
    }

    return NextResponse.json({
      success: true,
      compra,
      movimientos,
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}