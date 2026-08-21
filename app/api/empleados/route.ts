import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requirePermission, hashPassword } from '@/lib/auth'
import { Permiso } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const auth = requirePermission(req, 'ver_empleados' as Permiso)
    if (auth.error) return auth.error

    const { data: empleados, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, telefono, rol, activo, fecha_creacion')
      .eq('tenant_id', auth.user.tenantId)
      .neq('id', auth.user.userId)
      .order('fecha_creacion', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, empleados })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requirePermission(req, 'editar_empleados' as Permiso)
    if (auth.error) return auth.error

    const body = await req.json()
    const { nombre, email, telefono, rol, password } = body

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña requeridos' }, { status: 400 })
    }

    // Verificar email duplicado
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .insert({
        tenant_id: auth.user.tenantId,
        sucursal_id: auth.user.sucursalId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        nombre: nombre.trim(),
        telefono: telefono || null,
        rol: rol || 'mesero',
        activo: true,
      })
      .select('id, nombre, email, telefono, rol, activo')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, empleado: usuario }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = requirePermission(req, 'editar_empleados' as Permiso)
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const body = await req.json()
    const { nombre, email, telefono, rol, activo } = body

    const updates: any = {}
    if (nombre) updates.nombre = nombre.trim()
    if (email) updates.email = email.toLowerCase()
    if (telefono !== undefined) updates.telefono = telefono
    if (rol) updates.rol = rol
    if (activo !== undefined) updates.activo = activo
    updates.fecha_actualizacion = new Date().toISOString()

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.user.tenantId)
      .select('id, nombre, email, telefono, rol, activo')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, empleado: usuario })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requirePermission(req, 'editar_empleados' as Permiso)
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // No permitir eliminar al propio usuario
    if (id === auth.user.userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 403 })
    }

    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.user.tenantId)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Empleado eliminado' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}