import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { comparePassword, signToken, TOKEN_COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    console.log('Login intento:', email)

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !user) {
      console.log('Usuario no encontrado:', userError)
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    console.log('Usuario encontrado:', user.email, user.nombre)

    const valid = await comparePassword(password, user.password_hash)
    if (!valid) {
      console.log('Contraseña incorrecta')
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    console.log('Contraseña correcta')

    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan')
      .eq('id', user.tenant_id)
      .single()

    const plan = tenant?.plan || null

    await supabase
      .from('usuarios')
      .update({ ultima_visita: new Date().toISOString() })
      .eq('id', user.id)

    const token = signToken({
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      tenantId: user.tenant_id,
      sucursalId: user.sucursal_id,
      plan: plan,
    })

    console.log('Token generado')

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        telefono: user.telefono,
        direccion: user.direccion,
        tenant_id: user.tenant_id,
        sucursal_id: user.sucursal_id,
      }
    })

    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    console.log('Login exitoso')
    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || 'Error en el servidor' }, { status: 500 })
  }
}