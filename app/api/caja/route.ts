import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const tenantId = user.tenantId!
    const hoy = new Date().toISOString().split('T')[0]

    const result = await query(
      `SELECT c.*, u.nombre as usuario_nombre
       FROM cierres_caja c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.tenant_id = $1 AND c.fecha = $2
       ORDER BY c.hora_apertura DESC`,
      [tenantId, hoy]
    )

    const abiertoId = result.rows.find((r: any) => r.abierto)?.id || null

    let ventasPorMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, digital: 0, mixto: 0 }
    if (abiertoId) {
      const ventasRes = await query(
        `SELECT metodo_pago, COALESCE(SUM(total), 0) as total
         FROM pedidos
         WHERE tenant_id = $1
           AND estado = 'pagado'
           AND DATE(fecha_creacion) = $2
           AND hora_cierre IS NOT NULL
         GROUP BY metodo_pago`,
        [tenantId, hoy]
      )
      ventasPorMetodo = { efectivo: 0, tarjeta: 0, digital: 0, mixto: 0 }
      for (const row of ventasRes.rows) {
        if (row.metodo_pago) {
          ventasPorMetodo[row.metodo_pago] = parseFloat(row.total) || 0
        }
      }
    }

    return NextResponse.json({
      success: true,
      cierres: result.rows,
      caja_abierta_id: abiertoId,
      ventas_por_metodo: ventasPorMetodo,
    })
  } catch (error: any) {
    console.error('GET caja error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const tenantId = user.tenantId!
    const body = await req.json()
    const { saldo_inicial, turno, sucursal_id } = body

    if (saldo_inicial === undefined || saldo_inicial === null) {
      return NextResponse.json({ error: 'Saldo inicial es requerido' }, { status: 400 })
    }
    if (!turno) {
      return NextResponse.json({ error: 'Turno es requerido' }, { status: 400 })
    }

    const hoy = new Date().toISOString().split('T')[0]
    const abiertaRes = await query(
      `SELECT id FROM cierres_caja WHERE tenant_id = $1 AND fecha = $2 AND abierto = TRUE LIMIT 1`,
      [tenantId, hoy]
    )

    if (abiertaRes.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una caja abierta hoy. Ciérrela antes de abrir una nueva.' },
        { status: 409 }
      )
    }

    const result = await query(
      `INSERT INTO cierres_caja (tenant_id, sucursal_id, usuario_id, turno, fecha, saldo_inicial, abierto, hora_apertura)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        tenantId,
        sucursal_id || user.sucursalId || null,
        user.userId,
        turno.trim(),
        hoy,
        parseFloat(saldo_inicial) || 0,
      ]
    )

    return NextResponse.json({ success: true, cierre: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('POST caja error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const tenantId = user.tenantId!
    const body = await req.json()
    const { id, efectivo, tarjeta, digital, notas } = body

    if (!id) {
      return NextResponse.json({ error: 'ID de caja es requerido' }, { status: 400 })
    }

    const cajaRes = await query(
      `SELECT * FROM cierres_caja WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    )

    if (cajaRes.rows.length === 0) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
    }

    const caja = cajaRes.rows[0]
    if (!caja.abierto) {
      return NextResponse.json({ error: 'Esta caja ya está cerrada' }, { status: 409 })
    }

    const hoy = new Date().toISOString().split('T')[0]
    const ventasRes = await query(
      `SELECT metodo_pago, COALESCE(SUM(total), 0) as total
       FROM pedidos
       WHERE tenant_id = $1
         AND estado = 'pagado'
         AND DATE(fecha_creacion) = $2
         AND hora_cierre >= $3
         AND metodo_pago != 'mixto'
       GROUP BY metodo_pago`,
      [tenantId, hoy, caja.hora_apertura]
    )

    const ventasMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, digital: 0 }
    for (const row of ventasRes.rows) {
      if (row.metodo_pago && ventasMetodo[row.metodo_pago] !== undefined) {
        ventasMetodo[row.metodo_pago] = parseFloat(row.total) || 0
      }
    }

    const mixtoRes = await query(
      `SELECT total
       FROM pedidos
       WHERE tenant_id = $1
         AND estado = 'pagado'
         AND DATE(fecha_creacion) = $2
         AND hora_cierre >= $3
         AND metodo_pago = 'mixto'`,
      [tenantId, hoy, caja.hora_apertura]
    )

    const saldoInicial = parseFloat(caja.saldo_inicial) || 0
    const totalEfectivoEsperado = saldoInicial + ventasMetodo.efectivo
    const totalTarjetaEsperado = ventasMetodo.tarjeta
    const totalDigitalEsperado = ventasMetodo.digital
    const totalMixto = mixtoRes.rows.reduce((acc: number, r: any) => acc + (parseFloat(r.total) || 0), 0)

    const efectivoContado = parseFloat(efectivo) || 0
    const tarjetaContado = parseFloat(tarjeta) || 0
    const digitalContado = parseFloat(digital) || 0

    const totalEsperado = totalEfectivoEsperado + totalTarjetaEsperado + totalDigitalEsperado + totalMixto
    const totalContado = efectivoContado + tarjetaContado + digitalContado
    const diferencia = totalContado - totalEsperado

    const result = await query(
      `UPDATE cierres_caja
       SET efectivo = $1,
           tarjeta = $2,
           digital = $3,
           total_esperado = $4,
           total_contado = $5,
           diferencia = $6,
           notas = $7,
           abierto = FALSE,
           hora_cierre = CURRENT_TIMESTAMP
       WHERE id = $8 AND tenant_id = $9
       RETURNING *`,
      [
        efectivoContado,
        tarjetaContado,
        digitalContado,
        totalEsperado,
        totalContado,
        diferencia,
        notas || null,
        id,
        tenantId,
      ]
    )

    return NextResponse.json({
      success: true,
      cierre: result.rows[0],
      detalle_esperado: {
        saldo_inicial: saldoInicial,
        ventas_efectivo: ventasMetodo.efectivo,
        ventas_tarjeta: ventasMetodo.tarjeta,
        ventas_digital: ventasMetodo.digital,
        ventas_mixto: totalMixto,
        total_efectivo_esperado: totalEfectivoEsperado,
      },
    })
  } catch (error: any) {
    console.error('PATCH caja error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
