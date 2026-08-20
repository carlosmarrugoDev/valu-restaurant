import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthUser, requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req)
    const tenantAuth = auth?.tenantId ? { user: auth, error: null } : requireTenantAuth(req)

    if (tenantAuth.error) return tenantAuth.error

    const { searchParams } = new URL(req.url)
    const includeAll = searchParams.get('all') === 'true'

    let query = supabase.from('categorias').select('*')

    if (!includeAll && tenantAuth.user?.tenantId) {
      query = query.eq('tenant_id', tenantAuth.user.tenantId)
    }

    query = query.order('orden', { ascending: true }).order('nombre', { ascending: true })

    const { data: categorias, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, categorias })
  } catch (error: any) {
    console.error('Get categorias error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const body = await req.json()
    const { nombre, descripcion, color, orden, activa } = body

    if (!nombre) {
      return NextResponse.json({ error: 'Nombre de categoría requerido' }, { status: 400 })
    }

    const tenantId = auth.user.tenantId
    const { data: existing } = await supabase
      .from('categorias')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('nombre', nombre.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 409 },
      )
    }

    const { data: categoria, error } = await supabase
      .from('categorias')
      .insert({
        tenant_id: tenantId,
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        color: color || null,
        orden: orden ?? 0,
        activa: activa !== undefined ? activa : true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, categoria }, { status: 201 })
  } catch (error: any) {
    console.error('Create categoria error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID de categoría requerido' }, { status: 400 })
    }

    const body = await req.json()
    const allowed = ['nombre', 'descripcion', 'color', 'orden', 'activa']
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

    const { data: categoria, error } = await supabase
      .from('categorias')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.user.tenantId)
      .select()
      .single()

    if (error) throw error
    if (!categoria) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, categoria })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID de categoría requerido' }, { status: 400 })
    }

    const { count } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('categoria_id', id)
      .eq('tenant_id', auth.user.tenantId)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${count} productos asociados` },
        { status: 409 },
      )
    }

    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.user.tenantId)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Categoría eliminada' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
