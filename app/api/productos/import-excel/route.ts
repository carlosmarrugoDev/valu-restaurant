import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const tenantId = auth.user.tenantId

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

    // Obtener categorías existentes
    const { data: catsExistentes } = await supabase
      .from('categorias')
      .select('id, nombre')
      .eq('tenant_id', tenantId)

    const categoriasMap = new Map<string, string>()
    catsExistentes?.forEach((c: any) => {
      categoriasMap.set(c.nombre.toLowerCase().trim(), c.id)
    })

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
        const disponibleStr = String(row.disponible ?? row.Disponible ?? 'true').toLowerCase()
        const disponible = disponibleStr !== 'false' && disponibleStr !== 'no' && disponibleStr !== '0'
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

              // Verificar si existe en Supabase
              const { data: existing } = await supabase
                .from('categorias')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('nombre', cNombre)
                .maybeSingle()

              if (existing) {
                categoriaId = existing.id
              } else {
                // Crear categoría
                const newOrden = categoriasMap.size + categoriasNuevas.size + 1
                const { data: nuevaCat, error: catError } = await supabase
                  .from('categorias')
                  .insert({
                    tenant_id: tenantId,
                    nombre: cNombre,
                    orden: newOrden,
                    activa: true,
                  })
                  .select()
                  .single()

                if (catError) throw catError

                categoriaId = nuevaCat.id
                categoriasNuevas.set(categoriaNormalizada, categoriaId)
              }
              categoriasMap.set(categoriaNormalizada, categoriaId)
            } else {
              categoriaId = categoriasNuevas.get(categoriaNormalizada) || null
            }
          }
        }

        const { data: nuevoProducto, error: prodError } = await supabase
          .from('productos')
          .insert({
            tenant_id: tenantId,
            nombre: nombre,
            descripcion: descripcion,
            precio: precio || 0,
            costo: costo || Math.round((precio || 0) * 0.35),
            categoria_id: categoriaId,
            imagen_url: imagen,
            stock: stock || 0,
            disponible: disponible,
            tiempo_preparacion: tiempo || 10,
          })
          .select()
          .single()

        if (prodError) throw prodError

        creados.push(nuevoProducto)
      } catch (rowError: any) {
        errores.push({ fila: i + 2, error: rowError.message, datos: rows[i] })
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      creados: creados.length,
      errores: errores.length,
      detallesErrores: errores.slice(0, 50),
      categoriasNuevas: categoriasNuevas.size,
    })
  } catch (error: any) {
    console.error('Import Excel error:', error)
    return NextResponse.json(
      { error: error.message || 'Error importando Excel' },
      { status: 500 },
    )
  }
}
