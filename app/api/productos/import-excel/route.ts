import { NextResponse, NextRequest } from 'next/server'
import { query, getClient } from '@/lib/db'
import { initDatabase } from '@/lib/db-init'
import { requireTenantAuth } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    await initDatabase()
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const { tenantId } = auth.user

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Archivo Excel requerido' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo Excel no contiene datos' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const categoriasRes = await client.query(
        'SELECT id, nombre FROM categorias WHERE tenant_id = $1',
        [tenantId],
      )
      const categoriasMap = new Map<string, string>()
      for (const cat of categoriasRes.rows) {
        categoriasMap.set(cat.nombre.toLowerCase().trim(), cat.id)
      }

      const creados: any[] = []
      const errores: { fila: number; error: string; datos: any }[] = []
      const categoriasNuevas = new Map<string, string>()

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i]
          const nombre = String(row.nombre || row.Nombre || row.producto || row.Producto || '').trim()
          const precio = Number(row.precio || row.Precio || row.precio_venta || row.precioVenta || 0)
          const categoria = String(row.categoria || row.Categoria || row.categoría || row.Categoría || '').trim()
          const descripcion = String(row.descripcion || row.Descripcion || row.descripción || row.Descripción || '').trim() || null
          const stock = Number(row.stock || row.Stock || row.cantidad || row.existencia || 0)
          const imagen = String(row.imagen || row.Imagen || row.imagen_url || row.foto || '').trim() || null
          const costo = Number(row.costo || row.Costo || row.costo_unitario || 0)
          const disponible = String(row.disponible ?? row.Disponible ?? 'true').toLowerCase() !== 'false'
          const tiempo = Number(row.tiempo_preparacion || row.tiempo || 10)

          if (!nombre) {
            errores.push({ fila: i + 2, error: 'Nombre de producto vacío', datos: row })
            continue
          }

          let categoriaId: string | null = null
          if (categoria) {
            const categoriaNormalizada = categoria.toLowerCase().trim()
            categoriaId = categoriasMap.get(categoriaNormalizada) || null
            if (!categoriaId) {
              if (!categoriasNuevas.has(categoriaNormalizada)) {
                const cNombre = categoriaNormalizada.charAt(0).toUpperCase() + categoriaNormalizada.slice(1)
                const existing = await client.query(
                  `SELECT id FROM categorias WHERE tenant_id = $1 AND nombre = $2`,
                  [tenantId, cNombre],
                )
                if (existing.rows.length > 0) {
                  categoriaId = existing.rows[0].id
                } else {
                  const nuevaCat = await client.query(
                    `INSERT INTO categorias (tenant_id, nombre, orden, activa)
                     VALUES ($1, $2, $3, TRUE) RETURNING *`,
                    [tenantId, cNombre, categoriasMap.size + categoriasNuevas.size + 1],
                  )
                  categoriaId = nuevaCat.rows[0].id
                  categoriasNuevas.set(categoriaNormalizada, categoriaId)
                }
                categoriasMap.set(categoriaNormalizada, categoriaId)
              } else {
                categoriaId = categoriasNuevas.get(categoriaNormalizada) || null
              }
            }
          }

          const result = await client.query(
            `INSERT INTO productos (tenant_id, nombre, descripcion, precio, costo, categoria_id, imagen_url, stock, disponible, tiempo_preparacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              tenantId,
              nombre,
              descripcion,
              precio || 0,
              costo || Math.round((precio || 0) * 0.35),
              categoriaId,
              imagen,
              stock || 0,
              disponible,
              tiempo || 10,
            ],
          )
          creados.push(result.rows[0])
        } catch (rowError: any) {
          errores.push({ fila: i + 2, error: rowError.message, datos: rows[i] })
        }
      }

      await client.query('COMMIT')
      return NextResponse.json({
        success: true,
        total: rows.length,
        creados: creados.length,
        errores: errores.length,
        detallesErrores: errores.slice(0, 50),
        categoriasNuevas: categoriasNuevas.size,
      })
    } catch (txError) {
      try { await client.query('ROLLBACK') } catch {}
      throw txError
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Import Excel error:', error)
    return NextResponse.json(
      { error: error.message || 'Error importando Excel' },
      { status: 500 },
    )
  }
}
