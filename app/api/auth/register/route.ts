// app/api/auth/register/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashPassword, signToken, TOKEN_COOKIE_NAME } from '@/lib/auth'
import { createTenant, getMainSucursal } from '@/lib/db-init'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, nombre, nombre_restaurante, plan, telefono, direccion } = body

    if (!email || !password || !nombre || !nombre_restaurante) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 })
    }

    // Crear tenant (restaurante)
    const tenantId = await createTenant(nombre_restaurante, plan || 'profesional', telefono, direccion)
    const sucursalId = await getMainSucursal(tenantId)

    // Actualizar email de contacto
    await supabase
      .from('tenants')
      .update({ email_contacto: email.toLowerCase() })
      .eq('id', tenantId)

    // Crear usuario
    const passwordHash = await hashPassword(password)
    const { data: user, error } = await supabase
      .from('usuarios')
      .insert({
        tenant_id: tenantId,
        sucursal_id: sucursalId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        nombre: nombre,
        rol: 'dueno',
        telefono: telefono || null,
        direccion: direccion || null,
      })
      .select()
      .single()

    if (error) throw error

    const token = signToken({
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      tenantId: tenantId,
      sucursalId: sucursalId,
      plan: plan || 'profesional',
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        tenant_id: tenantId,
        sucursal_id: sucursalId,
      }
    }, { status: 201 })

    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}