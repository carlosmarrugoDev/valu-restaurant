'use client'

import { useState, useEffect } from 'react'
import { PackageCheck, Clock, Users, Bell, Loader2, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'

export function PendingDeliveries() {
  const { user } = useAuth()
  const [pedidosListos, setPedidosListos] = useState<any[]>([])
  const [pedidosEntregados, setPedidosEntregados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'pendientes' | 'entregados'>('pendientes')

  useEffect(() => {
    loadPedidos()
    const interval = setInterval(loadPedidos, 5000)
    return () => clearInterval(interval)
  }, [user])

  const loadPedidos = async () => {
    try {
      const [listosRes, entregadosRes] = await Promise.all([
        fetch('/api/pedidos?estado=listo'),
        fetch('/api/pedidos?estado=entregado&limit=20'),
      ])
      const listosData = await listosRes.json()
      const entregadosData = await entregadosRes.json()
      
      if (listosRes.ok) {
        setPedidosListos(listosData.pedidos || [])
      }
      if (entregadosRes.ok) {
        setPedidosEntregados(entregadosData.pedidos || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const marcarEntregado = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'entregado' }),
      })
      if (res.ok) {
        toast.success('Pedido marcado como entregado')
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar entregado')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const filteredListos = pedidosListos.filter(p => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      p.codigo_reclamo?.toLowerCase().includes(searchLower) ||
      p.numero_pedido?.toString().includes(searchLower) ||
      p.mesa_nombre?.toLowerCase().includes(searchLower) ||
      p.items?.some((item: any) => item.nombre_producto.toLowerCase().includes(searchLower))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <PackageCheck className="size-6 text-primary" />
            Entregas
          </h1>
          <p className="text-sm text-muted-foreground">
            {pedidosListos.length} pedidos listos para entregar
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, mesa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'pendientes' ? 'default' : 'outline'}
          onClick={() => setTab('pendientes')}
          className="gap-2"
        >
          <Bell className="size-4" />
          Listos sin entregar ({pedidosListos.length})
        </Button>
        <Button
          variant={tab === 'entregados' ? 'default' : 'outline'}
          onClick={() => setTab('entregados')}
          className="gap-2"
        >
          <PackageCheck className="size-4" />
          Entregados hoy ({pedidosEntregados.length})
        </Button>
      </div>

      {tab === 'pendientes' ? (
        filteredListos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageCheck className="size-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">
                {search ? 'No se encontraron pedidos con esa búsqueda' : 'No hay pedidos listos sin entregar'}
              </p>
              <p className="text-sm text-muted-foreground">
                Los pedidos aparecerán aquí cuando cocina los marque como listos
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListos.map((pedido) => {
              const tiempoEspera = Math.floor((Date.now() - new Date(pedido.fecha_actualizacion).getTime()) / 60000)
              const esUrgente = tiempoEspera >= 10
              const itemsCount = pedido.items?.reduce((s: number, i: any) => s + i.cantidad, 0) || 0

              return (
                <Card key={pedido.id} className={esUrgente ? 'border-red-500/50 bg-red-500/5' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold">
                        Código: <span className="text-primary">{pedido.codigo_reclamo || pedido.numero_pedido}</span>
                      </CardTitle>
                      <Badge variant={esUrgente ? 'destructive' : 'outline'}>
                        <Clock className="size-3 mr-1" />
                        {tiempoEspera} min
                      </Badge>
                    </div>
                    <CardDescription>
                      {pedido.mesa_nombre || 'Para llevar'} · {new Date(pedido.fecha_creacion).toLocaleTimeString()}
                      {itemsCount > 0 && ` · ${itemsCount} items`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        {pedido.items?.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span>{item.cantidad}× {item.nombre_producto}</span>
                            <span className="text-muted-foreground">${(item.precio_unitario * item.cantidad).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold text-primary">${pedido.total?.toFixed(2)}</span>
                      </div>
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => marcarEntregado(pedido.id)}
                      >
                        <PackageCheck className="size-4 mr-2" />
                        Marcar como entregado
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos entregados hoy</CardTitle>
            <CardDescription>Últimos 20 pedidos entregados</CardDescription>
          </CardHeader>
          <CardContent>
            {pedidosEntregados.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay pedidos entregados hoy</p>
            ) : (
              <div className="space-y-3">
                {pedidosEntregados.map((pedido) => (
                  <div key={pedido.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">
                          #{pedido.codigo_reclamo || pedido.numero_pedido}
                        </span>
                        <span className="text-sm">{pedido.mesa_nombre || 'Para llevar'}</span>
                        <Badge variant="secondary" className="text-xs">
                          {new Date(pedido.fecha_entrega || pedido.fecha_actualizacion).toLocaleTimeString()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pedido.items?.length || 0} items · {new Date(pedido.fecha_creacion).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary">${pedido.total?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}