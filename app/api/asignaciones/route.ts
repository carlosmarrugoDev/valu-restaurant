// app/api/asignaciones/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { searchParams } = new URL(req.url)
    const mesaId = searchParams.get('mesa_id')
    const activas = searchParams.get('activas') === 'true'

    let query = supabase
      .from('asignaciones_mesa')
      .select(`
        *,
        mesas (nombre),
        usuarios (nombre, email, rol)
      `)
      .eq('tenant_id', user.tenantId)

    if (mesaId) query = query.eq('mesa_id', mesaId)
    if (activas) query = query.eq('activa', true)

    const { data, error: queryError } = await query
    if (queryError) throw queryError

    return NextResponse.json({ success: true, asignaciones: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const body = await req.json()
    const { mesa_id, usuario_id, turno } = body

    if (!mesa_id || !usuario_id || !turno) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Desactivar asignaciones anteriores de la misma mesa
    await supabase
      .from('asignaciones_mesa')
      .update({ activa: false })
      .eq('mesa_id', mesa_id)
      .eq('tenant_id', user.tenantId)

    // También actualizar el mesero_id en la tabla mesas para compatibilidad
    await supabase
      .from('mesas')
      .update({ mesero_id: usuario_id })
      .eq('id', mesa_id)
      .eq('tenant_id', user.tenantId)

    const { data: asignacion, error: createError } = await supabase
      .from('asignaciones_mesa')
      .insert({
        tenant_id: user.tenantId,
        mesa_id,
        usuario_id,
        turno,
      })
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({ success: true, asignacion }, { status: 201 })
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
    const { activa } = body

    const { data: asignacion, error: updateError } = await supabase
      .from('asignaciones_mesa')
      .update({ activa })
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single()

    if (updateError) throw updateError

    // Si se desactiva, limpiar también la tabla mesas
    if (activa === false && asignacion) {
      await supabase
        .from('mesas')
        .update({ mesero_id: null })
        .eq('id', asignacion.mesa_id)
        .eq('tenant_id', user.tenantId)
    } else if (activa === true && asignacion) {
      await supabase
        .from('mesas')
        .update({ mesero_id: asignacion.usuario_id })
        .eq('id', asignacion.mesa_id)
        .eq('tenant_id', user.tenantId)
    }

    return NextResponse.json({ success: true, asignacion })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}