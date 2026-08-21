'use client'

import { useState, useEffect, useRef } from 'react'
import { Clock, Check, CircleCheckBig, ChefHat, Loader2, Bell, Send, Edit2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'

function timerStyle(segundos: number) {
  const minutos = Math.floor(segundos / 60)
  if (minutos >= 20) return 'bg-destructive text-white'
  if (minutos >= 10) return 'bg-status-bill text-status-bill-foreground'
  return 'bg-status-free text-status-free-foreground'
}

function formatTiempo(segundos: number) {
  const mins = Math.floor(segundos / 60)
  const secs = segundos % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export function Kitchen() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tiempos, setTiempos] = useState<Record<string, number>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Editar tiempo estimado
  const [openTiempoDialog, setOpenTiempoDialog] = useState(false)
  const [pedidoEditando, setPedidoEditando] = useState<any | null>(null)
  const [tiempoEstimado, setTiempoEstimado] = useState<number>(10)

  useEffect(() => {
    const updateTiempos = () => {
      setPedidos(prev => prev.map(p => {
        const segundos = p.fecha_creacion
          ? Math.floor((Date.now() - new Date(p.fecha_creacion).getTime()) / 1000)
          : 0
        return { ...p, segundos_transcurridos: segundos }
      }))
    }

    const timer = setInterval(updateTiempos, 1000)
    intervalRef.current = timer

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    loadPedidos()
    const interval = setInterval(loadPedidos, 3000)
    return () => clearInterval(interval)
  }, [user])

  const loadPedidos = async () => {
    try {
      const res = await fetch('/api/cocina')
      const data = await res.json()
      if (res.ok) {
        const pedidosConTiempo = (data.pedidos || []).map((p: any) => {
          const segundos = p.fecha_creacion
            ? Math.floor((Date.now() - new Date(p.fecha_creacion).getTime()) / 1000)
            : 0
          return { ...p, segundos_transcurridos: segundos }
        })
        setPedidos(pedidosConTiempo)
        setError(null)
      } else {
        setError(data.error || 'Error al cargar pedidos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const marcarItemListo = async (pedidoId: string, itemId: string) => {
    try {
      const res = await fetch('/api/cocina', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedidoId,
          item_id: itemId,
          tipo: 'item'
        }),
      })
      if (res.ok) {
        toast.success('Item marcado como listo ✅')
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar item')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const marcarPedidoListo = async (pedidoId: string) => {
    try {
      const res = await fetch('/api/cocina', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedidoId,
          tipo: 'pedido'
        }),
      })
      if (res.ok) {
        toast.success(`🍽️ Pedido listo para servir!`, {
          duration: 5000,
        })
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar pedido')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  // NUEVO: Marcar como entregado (pagado)
  const marcarEntregado = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'entregado'
        }),
      })
      if (res.ok) {
        toast.success('✅ Pedido entregado al cliente')
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar entregado')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  // NUEVO: Editar tiempo estimado
  const abrirEditarTiempo = (pedido: any) => {
    setPedidoEditando(pedido)
    setTiempoEstimado(pedido.tiempo_estimado || 10)
    setOpenTiempoDialog(true)
  }

  const guardarTiempoEstimado = async () => {
    if (!pedidoEditando) return
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoEditando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiempo_estimado: tiempoEstimado
        }),
      })
      if (res.ok) {
        toast.success(`Tiempo estimado actualizado: ${tiempoEstimado} min`)
        setOpenTiempoDialog(false)
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al actualizar tiempo')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
        <button onClick={loadPedidos} className="mt-4 text-primary hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  // Pedidos activos: en_cocina y listo
  const pedidosActivos = pedidos.filter(p => 
    p.estado === 'en_cocina' || p.estado === 'listo'
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChefHat className="size-4 text-primary" />
          <span>
            <span className="font-medium text-foreground tabular-nums">{pedidosActivos.length}</span>
            comandas activas
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-free" /> A tiempo (&lt;10m)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-bill" /> Demorado (10-20m)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive" /> Crítico (&gt;20m)
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={loadPedidos}>
          <RefreshCw className="size-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {pedidosActivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-24 text-center">
          <CircleCheckBig className="size-12 text-status-free" />
          <p className="font-display text-xl font-semibold">¡Todo al día!</p>
          <p className="text-sm text-muted-foreground">No hay comandas activas en cocina.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pedidosActivos.map((pedido) => {
            const items = pedido.items || []
            const todosListos = items.every((i: any) => i.estado === 'listo')
            const enProgreso = items.some((i: any) => i.estado === 'en_cocina')
            const tiempo = pedido.segundos_transcurridos || 0
            const minutos = Math.floor(tiempo / 60)
            const tiempoEstimado = pedido.tiempo_estimado || 10
            const tiempoRestante = Math.max(0, tiempoEstimado - minutos)

            return (
              <div key={pedido.id} className="flex flex-col overflow-hidden rounded-xl border-2 border-border bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                  <div>
                    <p className="font-display text-lg font-bold leading-none">
                      {pedido.mesa_nombre || `Mesa #${pedido.mesa_id}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pedido #{pedido.numero_pedido || pedido.id.slice(0, 6)} · {pedido.mesero_nombre || 'Sin mesero'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums',
                      timerStyle(tiempo),
                    )}>
                      <Clock className="size-4" />
                      {formatTiempo(tiempo)}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span>Estimado: {tiempoEstimado}m</span>
                      <button
                        onClick={() => abrirEditarTiempo(pedido)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Edit2 className="size-3" />
                      </button>
                    </div>
                    {minutos >= 10 && (
                      <Badge variant="destructive" className="text-[10px] animate-pulse">
                        ⚠️ Demorado
                      </Badge>
                    )}
                    {tiempoRestante > 0 && minutos < tiempoEstimado && (
                      <Badge variant="outline" className="text-[10px] text-status-free">
                        ⏱️ {tiempoRestante}m restante
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      todosListos ? 'bg-status-free/25 text-status-free' :
                      enProgreso ? 'bg-status-bill/25 text-status-bill' :
                      'bg-primary/25 text-primary',
                    )}>
                      {pedido.estado === 'listo' ? '✅ Listo' : 
                       todosListos ? '✅ Listo' : 
                       enProgreso ? '⏳ En preparación' : '📋 Pendiente'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {items.filter((i: any) => i.estado === 'listo').length}/{items.length} listos
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto">
                    {items.map((item: any, i: number) => {
                      const estaListo = item.estado === 'listo'
                      return (
                        <li key={i} className={cn(
                          'flex flex-col gap-0.5 rounded-lg p-2 transition-colors',
                          estaListo ? 'bg-status-free/10' : 'bg-muted/30'
                        )}>
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-lg font-bold text-primary tabular-nums">
                                {item.cantidad}×
                              </span>
                              <span className={cn(
                                'text-base font-medium leading-tight',
                                estaListo && 'line-through text-muted-foreground'
                              )}>
                                {item.nombre_producto}
                              </span>
                            </div>
                            {estaListo ? (
                              <Check className="size-5 text-status-free" />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-500/50 text-green-500 hover:bg-green-500/10"
                                onClick={() => marcarItemListo(pedido.id, item.id)}
                              >
                                <Check className="size-3 mr-1" />
                                Listo
                              </Button>
                            )}
                          </div>
                          {item.notas && (
                            <span className="ml-7 rounded bg-status-bill/15 px-2 py-0.5 text-xs font-medium text-status-bill">
                              📝 {item.notas}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="p-3 border-t border-border flex flex-col gap-2">
                  {pedido.estado === 'listo' ? (
                    <>
                      <Button
                        size="lg"
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => marcarEntregado(pedido.id)}
                      >
                        <Send className="size-4 mr-2" />
                        Marcar como Entregado
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        El cliente recibirá notificación de entrega
                      </p>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full"
                      variant={todosListos ? 'default' : 'secondary'}
                      onClick={() => marcarPedidoListo(pedido.id)}
                      disabled={!todosListos}
                    >
                      {todosListos ? (
                        <>
                          <Bell className="size-4 mr-2" />
                          Notificar que está listo
                        </>
                      ) : (
                        <>
                          <Clock className="size-4 mr-2" />
                          Esperando items...
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog Editar Tiempo Estimado */}
      <Dialog open={openTiempoDialog} onOpenChange={setOpenTiempoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar tiempo estimado</DialogTitle>
            <DialogDescription>
              Actualiza el tiempo estimado para {pedidoEditando?.mesa_nombre || 'este pedido'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tiempo estimado (minutos)</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTiempoEstimado(Math.max(1, tiempoEstimado - 1))}
                >
                  -
                </Button>
                <span className="text-2xl font-bold w-16 text-center">{tiempoEstimado}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTiempoEstimado(tiempoEstimado + 1)}
                >
                  +
                </Button>
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setTiempoEstimado(5)}>5m</Button>
                <Button variant="outline" size="sm" onClick={() => setTiempoEstimado(10)}>10m</Button>
                <Button variant="outline" size="sm" onClick={() => setTiempoEstimado(15)}>15m</Button>
                <Button variant="outline" size="sm" onClick={() => setTiempoEstimado(20)}>20m</Button>
                <Button variant="outline" size="sm" onClick={() => setTiempoEstimado(30)}>30m</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTiempoDialog(false)}>Cancelar</Button>
            <Button onClick={guardarTiempoEstimado}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}