// app/api/mesas/route.ts - COMPLETO CON CRUD
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth, PLAN_LIMITS } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { data: mesas, error: queryError } = await supabase
      .from('mesas')
      .select(`
        *,
        asignaciones_mesa!left (
          activa,
          usuario_id,
          usuarios!asignaciones_mesa_usuario_id_fkey (id, nombre, email, rol)
        )
      `)
      .eq('tenant_id', user.tenantId)
      .order('orden', { ascending: true })

    if (queryError) throw queryError

    // Formatear datos
    const formatted = mesas?.map((mesa: any) => {
      // Buscar la asignación activa
      const asignacionActiva = (mesa.asignaciones_mesa || []).find(
        (a: any) => a.activa === true
      )
      
      return {
        ...mesa,
        mesero_id: asignacionActiva?.usuario_id || null,
        mesero_nombre: asignacionActiva?.usuarios?.nombre || null,
        mesero_email: asignacionActiva?.usuarios?.email || null,
        asignaciones_mesa: undefined,
      }
    }) || []

    return NextResponse.json({ success: true, mesas: formatted })
  } catch (error: any) {
    console.error('Error GET mesas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { nombre, asientos, forma, zona } = body

    if (!nombre) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    // Verificar límite de mesas
    const { count } = await supabase
      .from('mesas')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId)

    const maxMesas = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS]?.maxMesas || Infinity
    if ((count || 0) >= maxMesas) {
      return NextResponse.json(
        { error: `Límite de mesas alcanzado (${maxMesas})` },
        { status: 403 }
      )
    }

    const { data: mesa, error: createError } = await supabase
      .from('mesas')
      .insert({
        tenant_id: user.tenantId,
        sucursal_id: user.sucursalId,
        nombre: nombre.trim(),
        asientos: asientos || 4,
        forma: forma || 'cuadro',
        zona: zona || null,
        estado: 'libre',
        orden: (count || 0) + 1,
      })
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({ success: true, mesa }, { status: 201 })
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
    const { nombre, asientos, forma, zona } = body

    const updates: Record<string, any> = {}
    if (nombre) updates.nombre = nombre.trim()
    if (asientos !== undefined) updates.asientos = asientos
    if (forma) updates.forma = forma
    if (zona !== undefined) updates.zona = zona
    updates.fecha_actualizacion = new Date().toISOString()

    const { data: mesa, error: updateError } = await supabase
      .from('mesas')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError
    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, mesa })
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

    // Verificar que no tenga pedidos activos
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id')
      .eq('mesa_id', id)
      .eq('tenant_id', user.tenantId)
      .neq('estado', 'pagado')
      .neq('estado', 'cancelado')
      .limit(1)

    if (pedidos && pedidos.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: la mesa tiene pedidos activos' },
        { status: 409 }
      )
    }

    const { error: deleteError } = await supabase
      .from('mesas')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Mesa eliminada' })
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
    const { estado, mesero_id } = body

    const updates: Record<string, any> = {}
    if (estado) updates.estado = estado
    if (mesero_id !== undefined) updates.mesero_id = mesero_id
    updates.fecha_actualizacion = new Date().toISOString()

    const { data: mesa, error: updateError } = await supabase
      .from('mesas')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError
    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, mesa })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}