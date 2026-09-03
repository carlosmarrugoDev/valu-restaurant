import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { initDatabase } from '@/lib/db-init'
import { getAuthUser, requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await initDatabase()
    const auth = getAuthUser(req)
    const tenantAuth = auth?.tenantId ? { user: auth, error: null } : requireTenantAuth(req)

    const { searchParams } = new URL(req.url)
    const includeAll = searchParams.get('all') === 'true'

    let sql = 'SELECT * FROM categorias WHERE 1=1'
    const params: any[] = []
    let idx = 1

    if (!includeAll && tenantAuth.user?.tenantId) {
      sql += ` AND tenant_id = $${idx}`
      params.push(tenantAuth.user.tenantId)
      idx++
    }

    if (includeAll && !tenantAuth.user) {
      sql += ` AND tenant_id IS NULL`
    }

    sql += ' ORDER BY orden ASC, nombre ASC'

    const result = await query(sql, params.length > 0 ? params : undefined)
    return NextResponse.json({ success: true, categorias: result.rows })
  } catch (error: any) {
    console.error('Get categorias error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDatabase()
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const body = await req.json()
    const { nombre, descripcion, color, orden, activa } = body

    if (!nombre) {
      return NextResponse.json({ error: 'Nombre de categoría requerido' }, { status: 400 })
    }

    const tenantId = auth.user.tenantId
    const existing = await query(
      `SELECT id FROM categorias WHERE tenant_id = $1 AND nombre = $2`,
      [tenantId, nombre.trim()],
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' },
        { status: 409 },
      )
    }

    const result = await query(
      `INSERT INTO categorias (tenant_id, nombre, descripcion, color, orden, activa)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        nombre.trim(),
        descripcion || null,
        color || null,
        orden ?? 0,
        activa !== undefined ? activa : true,
      ],
    )

    return NextResponse.json({ success: true, categoria: result.rows[0] }, { status: 201 })
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

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    values.push(id)
    values.push(auth.user.tenantId)

    const result = await query(
      `UPDATE categorias SET ${updates.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING *`,
      values,
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, categoria: result.rows[0] })
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

    const used = await query(
      `SELECT COUNT(*)::int as count FROM productos WHERE categoria_id = $1 AND tenant_id = $2`,
      [id, auth.user.tenantId],
    )
    if (used.rows[0].count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${used.rows[0].count} productos asociados` },
        { status: 409 },
      )
    }

    const result = await query(
      `DELETE FROM categorias WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, auth.user.tenantId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Categoría eliminada' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
