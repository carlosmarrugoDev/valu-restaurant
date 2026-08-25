// app/api/productos/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'
import { obtenerDisponibilidadProductos } from '@/lib/inventario'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const categoriaId = searchParams.get('categoria')
    const search = searchParams.get('search')

    let query = supabase
      .from('productos')
      .select(`
        *,
        categorias!categoria_id (nombre)
      `)
      .eq('tenant_id', user.tenantId)

    if (categoriaId) {
      query = query.eq('categoria_id', categoriaId)
    }

    if (search) {
      query = query.ilike('nombre', `%${search}%`)
    }

    const { data: productos } = await query.order('fecha_creacion', { ascending: false })
    
    // Obtener disponibilidad dinámica basada en recetas e inventario
    const disponibilidad = await obtenerDisponibilidadProductos(user.tenantId!)

    const formatted = await Promise.all((productos || []).map(async p => {
      const dispInfo = disponibilidad[p.id];
      
      // Calcular costo real si el plan lo permite
      let costoReal = p.costo;
      const { data: receta } = await supabase
        .from('recetas')
        .select(`
          receta_items (
            cantidad,
            insumos (costo_unitario)
          )
        `)
        .eq('producto_id', p.id)
        .eq('tenant_id', user.tenantId)
        .maybeSingle();
      
      if (receta?.receta_items) {
        costoReal = receta.receta_items.reduce((acc: number, item: any) => {
          return acc + (item.cantidad * (item.insumos?.costo_unitario || 0));
        }, 0);
      }

      const margen = p.precio > 0 ? ((p.precio - costoReal) / p.precio) * 100 : 0;

      return {
        ...p,
        disponible: dispInfo ? dispInfo.disponible : p.disponible,
        stock_calculado: dispInfo ? dispInfo.stock_disponible : p.stock,
        costo_calculado: costoReal,
        margen_porcentaje: Math.round(margen),
        categoria_nombre: p.categorias?.nombre || null,
        categorias: undefined
      };
    }))

    return NextResponse.json({ success: true, productos: formatted })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { nombre, descripcion, precio, categoria_id, imagen_url, stock, disponible } = body

    if (!nombre) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const { data: producto, error: createError } = await supabase
      .from('productos')
      .insert({
        tenant_id: user.tenantId,
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        precio: precio || 0,
        costo: Math.round((precio || 0) * 0.35),
        categoria_id: categoria_id || null,
        imagen_url: imagen_url || null,
        stock: stock || 0,
        disponible: disponible !== undefined ? disponible : true,
        tiempo_preparacion: 10,
      })
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({ success: true, producto }, { status: 201 })
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
    const allowed = ['nombre', 'descripcion', 'precio', 'categoria_id', 'imagen_url', 'stock', 'disponible']
    const updates: Record<string, any> = {}

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    updates.fecha_actualizacion = new Date().toISOString()

    const { data: producto, error: updateError } = await supabase
      .from('productos')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError
    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, producto })
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
      .from('productos')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Producto eliminado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}