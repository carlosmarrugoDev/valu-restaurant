import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { requireTenantAuth } from '@/lib/auth'
import { PlanType } from '@/lib/db-init'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const tenantId = user.tenantId!

    const tenantResult = await query(
      `SELECT id, nombre, plan, telefono, direccion, logo_url, rfc, email_contacto,
              fecha_suscripcion, fecha_vencimiento, activo, fecha_creacion, fecha_actualizacion
       FROM tenants WHERE id = $1 AND activo = TRUE`,
      [tenantId],
    )

    if (tenantResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Restaurante no encontrado o inactivo' },
        { status: 404 },
      )
    }

    const tenant = tenantResult.rows[0]

    const sucursalesResult = await query(
      `SELECT id, tenant_id, nombre, telefono, direccion, ciudad, codigo_postal,
              horario_apertura, horario_cierre, activa, fecha_creacion, fecha_actualizacion
       FROM sucursales WHERE tenant_id = $1 ORDER BY fecha_creacion ASC`,
      [tenantId],
    )

    const statsResult = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM usuarios WHERE tenant_id = $1) as total_usuarios,
         (SELECT COUNT(*)::int FROM productos WHERE tenant_id = $1) as total_productos,
         (SELECT COUNT(*)::int FROM categorias WHERE tenant_id = $1) as total_categorias,
         (SELECT COUNT(*)::int FROM mesas WHERE tenant_id = $1) as total_mesas`,
      [tenantId],
    )

    return NextResponse.json({
      success: true,
      tenant,
      sucursales: sucursalesResult.rows,
      stats: statsResult.rows[0],
    })
  } catch (error: any) {
    console.error('Tenants GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const tenantId = user.tenantId!

    if (user.rol !== 'dueno' && user.rol !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado: solo el dueño o administrador pueden actualizar los datos del restaurante' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const allowed = [
      'nombre',
      'telefono',
      'direccion',
      'logo_url',
      'rfc',
      'email_contacto',
      'fecha_vencimiento',
    ]
    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = $${idx}`)
        values.push(body[key])
        idx++
      }
    }

    if (body.plan !== undefined) {
      const validPlans: PlanType[] = ['arranque', 'profesional', 'multi-sede']
      if (!validPlans.includes(body.plan as PlanType)) {
        return NextResponse.json(
          { error: 'Plan inválido. Debe ser arranque, profesional o multi-sede' },
          { status: 400 },
        )
      }
      updates.push(`plan = $${idx}`)
      values.push(body.plan)
      idx++
    }

    if (body.activo !== undefined && typeof body.activo === 'boolean') {
      updates.push(`activo = $${idx}`)
      values.push(body.activo)
      idx++
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    values.push(tenantId)
    updates.push(`fecha_actualizacion = CURRENT_TIMESTAMP`)

    const result = await query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, nombre, plan, telefono, direccion, logo_url, rfc, email_contacto,
                 fecha_suscripcion, fecha_vencimiento, activo, fecha_creacion, fecha_actualizacion`,
      values,
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      tenant: result.rows[0],
      message: 'Datos del restaurante actualizados correctamente',
    })
  } catch (error: any) {
    console.error('Tenants PUT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
