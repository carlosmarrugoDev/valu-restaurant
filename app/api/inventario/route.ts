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

export async function PUT(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const body = await req.json()
    const allowed = ['nombre', 'unidad', 'stock', 'stock_minimo', 'costo_unitario']
    const updates: Record<string, any> = {}

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = key === 'nombre' ? body[key].trim() : Number(body[key]) || body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    updates.fecha_actualizacion = new Date().toISOString()

    const { data: insumo, error: updateError } = await supabase
      .from('insumos')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError
    if (!insumo) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, insumo })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('insumos')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Insumo eliminado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}