import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { data: recetas, error: queryError } = await supabase
      .from('recetas')
      .select(`
        *,
        productos (id, nombre, precio),
        receta_items (
          id,
          cantidad,
          insumos (id, nombre, unidad, costo_unitario)
        )
      `)
      .eq('tenant_id', user.tenantId)

    if (queryError) throw queryError

    return NextResponse.json({ success: true, recetas: recetas || [] })
  } catch (error: any) {
    console.error('Error GET recetas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { producto_id, cantidad_producida, items } = body

    if (!producto_id) {
      return NextResponse.json({ error: 'Producto requerido' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un insumo' }, { status: 400 })
    }

    // Verificar si ya existe receta para este producto
    const { data: existing } = await supabase
      .from('recetas')
      .select('id')
      .eq('producto_id', producto_id)
      .eq('tenant_id', user.tenantId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Este producto ya tiene una receta' },
        { status: 409 }
      )
    }

    // Crear receta
    const { data: receta, error: recetaError } = await supabase
      .from('recetas')
      .insert({
        tenant_id: user.tenantId,
        producto_id,
        // cantidad_producida: cantidad_producida || 1, // Columna faltante en DB
      })
      .select()
      .single()

    if (recetaError) throw recetaError

    // Crear items de receta
    const itemsData = items.map((item: any) => ({
      receta_id: receta.id,
      insumo_id: item.insumo_id,
      cantidad: item.cantidad,
    }))

    const { error: itemsError } = await supabase
      .from('receta_items')
      .insert(itemsData)

    if (itemsError) throw itemsError

    return NextResponse.json({ success: true, receta }, { status: 201 })
  } catch (error: any) {
    console.error('Error POST recetas:', error)
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
    const { producto_id, cantidad_producida, items } = body

    // Actualizar receta
    const { error: updateError } = await supabase
      .from('recetas')
      .update({
        producto_id,
        // cantidad_producida: cantidad_producida || 1, // Columna faltante en DB
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', user.tenantId)

    if (updateError) throw updateError

    // Eliminar items antiguos
    await supabase
      .from('receta_items')
      .delete()
      .eq('receta_id', id)

    // Crear nuevos items
    if (items && items.length > 0) {
      const itemsData = items.map((item: any) => ({
        receta_id: id,
        insumo_id: item.insumo_id,
        cantidad: item.cantidad,
      }))
      await supabase.from('receta_items').insert(itemsData)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error PUT recetas:', error)
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

    // Eliminar items primero
    await supabase
      .from('receta_items')
      .delete()
      .eq('receta_id', id)

    // Eliminar receta
    const { error: deleteError } = await supabase
      .from('recetas')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error DELETE recetas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}