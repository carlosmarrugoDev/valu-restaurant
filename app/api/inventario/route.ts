// app/api/inventario/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth, checkPlanAccess } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    if (!checkPlanAccess(user.plan, 'inventario')) {
      return NextResponse.json(
        { error: 'El plan arranque no incluye inventario' },
        { status: 403 }
      )
    }

    const [insumos, recetas] = await Promise.all([
      supabase
        .from('insumos')
        .select('*')
        .eq('tenant_id', user.tenantId)
        .order('fecha_actualizacion', { ascending: false }),
      supabase
        .from('recetas')
        .select(`
          *,
          productos!producto_id (nombre, precio),
          receta_items (
            id,
            cantidad,
            insumos!insumo_id (id, nombre, unidad, costo_unitario)
          )
        `)
        .eq('tenant_id', user.tenantId)
    ])

    return NextResponse.json({
      success: true,
      insumos: insumos.data || [],
      recetas: recetas.data || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { nombre, unidad, stock, stock_minimo, costo_unitario } = body

    if (!nombre) {
      return NextResponse.json({ error: 'Nombre de insumo requerido' }, { status: 400 })
    }

    const { data: insumo, error: createError } = await supabase
      .from('insumos')
      .insert({
        tenant_id: user.tenantId,
        nombre: nombre.trim(),
        unidad: unidad || 'kg',
        stock: Number(stock) || 0,
        stock_minimo: Number(stock_minimo) || 5,
        costo_unitario: Number(costo_unitario) || 0,
      })
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({ success: true, insumo }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}