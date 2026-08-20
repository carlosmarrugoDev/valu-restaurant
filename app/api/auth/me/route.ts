// app/api/auth/me/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthUser, TOKEN_COOKIE_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req)
    if (!auth) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, rol, telefono, direccion, metodo_pago, preferencias, alergias, puntos, gasto_total, tenant_id, sucursal_id')
      .eq('id', auth.userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    let tenantNombre = 'Restaurante'
    let plan = auth.plan || 'profesional'

    if (user.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('nombre, plan')
        .eq('id', user.tenant_id)
        .single()

      if (tenant) {
        tenantNombre = tenant.nombre
        plan = tenant.plan || plan
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        tenant_nombre: tenantNombre,
        plan: plan,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthUser(req)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const allowed = ['nombre', 'telefono', 'direccion', 'metodo_pago', 'preferencias', 'alergias']
    const updates: Record<string, any> = {}

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', auth.userId)
      .select('id, email, nombre, rol, telefono, direccion, metodo_pago, preferencias, alergias, puntos, gasto_total, tenant_id, sucursal_id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada' })
  response.cookies.delete(TOKEN_COOKIE_NAME)
  return response
}