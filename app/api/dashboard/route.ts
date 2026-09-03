// app/api/dashboard/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireTenantAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req)
    if (error) return error

    const hoy = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)
    const ayerStr = ayer.toISOString().split('T')[0]

    // Ventas de hoy
    const { data: ventasHoy } = await supabase
      .from('pedidos')
      .select('total')
      .eq('tenant_id', user.tenantId)
      .eq('estado', 'pagado')
      .gte('fecha_creacion', hoyStr)

    // Ventas de ayer
    const { data: ventasAyer } = await supabase
      .from('pedidos')
      .select('total')
      .eq('tenant_id', user.tenantId)
      .eq('estado', 'pagado')
      .gte('fecha_creacion', ayerStr)
      .lt('fecha_creacion', hoyStr)

    // Ventas de la semana
    const semanaInicio = new Date(hoy)
    semanaInicio.setDate(semanaInicio.getDate() - 6)
    const { data: ventasSemana } = await supabase
      .from('pedidos')
      .select('total')
      .eq('tenant_id', user.tenantId)
      .eq('estado', 'pagado')
      .gte('fecha_creacion', semanaInicio.toISOString().split('T')[0])

    // Mesas
    const { data: mesas } = await supabase
      .from('mesas')
      .select('id, estado')
      .eq('tenant_id', user.tenantId)

    // Ticket promedio
    const { data: tickets } = await supabase
      .from('pedidos')
      .select('total')
      .eq('tenant_id', user.tenantId)
      .eq('estado', 'pagado')
      .gte('fecha_creacion', hoyStr)
      .gt('total', 0)

    // Top platillos (semana)
    const { data: topPlatillos } = await supabase
      .from('pedido_items')
      .select(`
        cantidad,
        productos!inner (
          id,
          nombre,
          imagen_url
        )
      `)
      .eq('pedidos.tenant_id', user.tenantId)
      .eq('pedidos.estado', 'pagado')
      .gte('pedidos.fecha_creacion', semanaInicio.toISOString().split('T')[0])

    // Agrupar top platillos
    const platillosMap: Record<string, any> = {}
    topPlatillos?.forEach((item: any) => {
      const p = item.productos
      if (!p) return
      if (!platillosMap[p.id]) {
        platillosMap[p.id] = { ...p, items_vendidos: 0 }
      }
      platillosMap[p.id].items_vendidos += item.cantidad
    })
    const topPlatillosList = Object.values(platillosMap)
      .sort((a: any, b: any) => b.items_vendidos - a.items_vendidos)
      .slice(0, 5)

    // Ventas por hora (hoy)
    const { data: pedidosHoyHora } = await supabase
      .from('pedidos')
      .select('total, fecha_creacion')
      .eq('tenant_id', user.tenantId)
      .eq('estado', 'pagado')
      .gte('fecha_creacion', hoyStr)

    const horasMap: Record<string, number> = {
      '10h': 0, '11h': 0, '12h': 0, '13h': 0, '14h': 0,
      '15h': 0, '16h': 0, '17h': 0, '18h': 0, '19h': 0,
      '20h': 0, '21h': 0, '22h': 0
    }

    pedidosHoyHora?.forEach((p: any) => {
      if (p.fecha_creacion) {
        const hourNum = new Date(p.fecha_creacion).getHours()
        const key = `${hourNum}h`
        if (horasMap[key] !== undefined) {
          horasMap[key] += p.total || 0
        }
      }
    })

    const ventasPorHoraList = Object.entries(horasMap).map(([hora, ventas]) => ({ hora, ventas }))

    // Alertas de stock bajo (insumos)
    const { data: insumosBajos } = await supabase
      .from('insumos')
      .select('*')
      .eq('tenant_id', user.tenantId)

    const alertasStockBajo = (insumosBajos || [])
      .filter((ins: any) => ins.stock <= ins.stock_minimo)
      .map((ins: any) => ({
        id: ins.id,
        nombre: ins.nombre,
        stock: ins.stock,
        stock_minimo: ins.stock_minimo,
        unidad: ins.unidad || 'unidades',
        faltante: ins.stock_minimo - ins.stock
      }))

    const totalHoy = ventasHoy?.reduce((s, p) => s + (p.total || 0), 0) || 0
    const totalAyer = ventasAyer?.reduce((s, p) => s + (p.total || 0), 0) || 0
    const delta = totalAyer > 0 ? ((totalHoy - totalAyer) / totalAyer) * 100 : (totalHoy > 0 ? 100 : 0)

    const totalMesas = mesas?.length || 0
    const ocupadas = mesas?.filter(m => m.estado === 'ocupada' || m.estado === 'cuenta').length || 0

    const ticketsList = tickets?.filter(t => t.total > 0) || []
    const ticketPromedio = ticketsList.length > 0
      ? ticketsList.reduce((s, t) => s + (t.total || 0), 0) / ticketsList.length
      : 0

    return NextResponse.json({
      success: true,
      metricas: {
        ventas_hoy: {
          total: totalHoy,
          pedidos: ventasHoy?.length || 0,
          delta_porcentaje: Number(delta.toFixed(2)),
          tendencia: totalHoy >= totalAyer ? 'up' : 'down',
        },
        ventas_semana: {
          total: ventasSemana?.reduce((s, p) => s + (p.total || 0), 0) || 0,
          pedidos: ventasSemana?.length || 0,
        },
        ticket_promedio: ticketPromedio,
        mesas: {
          total: totalMesas,
          ocupadas: ocupadas,
          disponibles: totalMesas - ocupadas,
          porcentaje_ocupacion: totalMesas > 0 ? Number(((ocupadas / totalMesas) * 100).toFixed(1)) : 0,
        },
        ventas_por_hora: ventasPorHoraList,
        top_platillos: topPlatillosList,
        alertas_stock_bajo: alertasStockBajo,
      }
    })
  } catch (error: any) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}