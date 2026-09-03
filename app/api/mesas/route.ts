// app/api/mesas/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth, PLAN_LIMITS } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const { data: mesas } = await supabase
      .from('mesas')
      .select(`
        *,
        usuarios!mesero_id (nombre)
      `)
      .eq('tenant_id', user.tenantId)
      .order('orden', { ascending: true })

    const formatted = mesas?.map(m => ({
      ...m,
      mesero_nombre: m.usuarios?.nombre || null,
      usuarios: undefined
    })) || []

    return NextResponse.json({ success: true, mesas: formatted })
  } catch (error: any) {
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
      })
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({ success: true, mesa }, { status: 201 })
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