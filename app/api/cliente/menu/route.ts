import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { obtenerDisponibilidadProductos } from '@/lib/inventario'
import { resolverMesaPublica } from '@/lib/cliente-publico'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mesa = await resolverMesaPublica(
      searchParams.get('mesa'),
      searchParams.get('mid'),
    )

    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    const [{ data: productos }, { data: categorias }, disponibilidad] = await Promise.all([
      supabase
        .from('productos')
        .select('*')
        .eq('tenant_id', mesa.tenant_id)
        .eq('disponible', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('categorias')
        .select('*')
        .eq('tenant_id', mesa.tenant_id)
        .order('orden', { ascending: true }),
      obtenerDisponibilidadProductos(mesa.tenant_id),
    ])

    const formatted = (productos || []).map((p) => {
      const dispInfo = disponibilidad[p.id]
      return {
        ...p,
        disponible: dispInfo ? dispInfo.disponible : p.disponible,
        stock_calculado: dispInfo ? dispInfo.stock_disponible : p.stock,
      }
    })

    return NextResponse.json({
      success: true,
      mesa,
      productos: formatted,
      categorias: categorias || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
