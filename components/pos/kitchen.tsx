'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Clock, Check, CircleCheckBig, ChefHat, Loader2, Bell, Send, Edit2, X, RefreshCw, UserCheck, LogOut,
  Megaphone, HandCoins, PackageCheck
} from 'lucide-react'

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
  const mins = Math.max(0, Math.floor(segundos / 60))
  const horas = Math.floor(mins / 60)
  const minsRest = mins % 60
  if (horas >= 1) {
    return horas === 1 && minsRest === 0
      ? '1 h'
      : minsRest === 0
        ? `${horas} h`
        : `${horas}h ${minsRest}m`
  }
  if (mins === 0) return '<1m'
  return `${mins} min`
}

export function Kitchen() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const tomarPedido = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'tomar_preparacion' }),
      })
      if (res.ok) {
        toast.success('Pedido tomado. Comienza a prepararlo.')
        await loadPedidos()
      } else {
        const d = await res.json()
        toast.error(d.error || 'No se pudo tomar el pedido')
      }
    } catch {
      toast.error('Error de conexion')
    }
  }

  const liberarPedido = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'liberar_pedido' }),
      })
      if (res.ok) {
        toast.info('Pedido liberado. Otro cocinero podra tomarlo.')
        await loadPedidos()
      } else {
        const d = await res.json()
        toast.error(d.error || 'No se pudo liberar')
      }
    } catch {
      toast.error('Error de conexion')
    }
  }

  const marcarItemListo = async (pedidoId: string, itemId: string, pedido: any) => {
    if (pedido.cocinero_id && user && pedido.cocinero_id !== user.id && user.rol !== 'dueno' && user.rol !== 'gerente') {
      toast.error('Solo el cocinero que tomo el pedido puede marcar items.')
      return
    }
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
        toast.success('Item listo.')
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar item')
      }
    } catch {
      toast.error('Error de conexion')
    }
  }

  const marcarPedidoListo = async (pedido: any) => {
    if (pedido.cocinero_id && user && pedido.cocinero_id !== user.id && user.rol !== 'dueno' && user.rol !== 'gerente') {
      toast.error('Solo el cocinero que tomo el pedido puede marcarlo listo.')
      return
    }
    try {
      const res = await fetch('/api/cocina', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          tipo: 'pedido'
        }),
      })
      if (res.ok) {
        toast.success('Pedido listo. Se notifica al cliente.', {
          duration: 5000,
        })
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar pedido')
      }
    } catch {
      toast.error('Error de conexion')
    }
  }

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
        toast.success('Pedido entregado. Mesa liberada y cliente notificado.', {
          duration: 5000,
        })
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al marcar entregado')
      }
    } catch {
      toast.error('Error de conexion')
    }
  }

  const notificarClienteManual = async (pedidoId: string) => {
    try {
      const res = await fetch('/api/cocina', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedidoId,
          tipo: 'notificar_cliente'
        }),
      })
      if (res.ok) {
        toast.success('Cliente notificado nuevamente.', {
          description: 'El celular del cliente recibio un recordatorio.',
          duration: 4000,
        })
        await loadPedidos()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al notificar')
      }
    } catch {
      toast.error('Error de conexion')
    }
  }

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
      toast.error('Error de conexion')
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

  const pedidosActivos = pedidos.filter(p =>
    ['en_cocina', 'en_espera_cocina', 'en_preparacion', 'listo'].includes(p.estado)
  )

  const pedidoTomadoPorMi = (p: any) => user && p.cocinero_id === user.id
  const pedidoTomadoPorOtro = (p: any) => p.cocinero_id && user && p.cocinero_id !== user.id

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChefHat className="size-4 text-primary" />
          <span>
            <span className="font-medium text-foreground tabular-nums">{pedidosActivos.length}</span>
            {' '}comandas activas
          </span>
          {user && (
            <Badge variant="outline" className="ml-2">
              Sesion: {user.nombre || user.email}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-free" /> A tiempo ({`<`}10m)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-bill" /> Demorado (10-20m)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive" /> Critico ({`>`}20m)
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
          <p className="font-display text-xl font-semibold">Todo al dia.</p>
          <p className="text-sm text-muted-foreground">
            No hay comandas activas en cocina en este momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pedidosActivos.map((pedido) => {
            const items = pedido.items || []
            const todosListos = items.length > 0 && items.every((i: any) => i.estado === 'listo')
            const enProgreso = items.some((i: any) => ['pendiente_pago', 'pendiente', 'en_cocina', 'en_preparacion'].includes(i.estado)) && !todosListos
            const tiempo = pedido.segundos_transcurridos || 0
            const minutos = Math.floor(tiempo / 60)
            const tEst = pedido.tiempo_estimado || 10
            const tiempoRestante = Math.max(0, tEst - minutos)
            const tomadoPorMi = pedidoTomadoPorMi(pedido)
            const tomadoPorOtro = pedidoTomadoPorOtro(pedido)
            const sinAsignar = pedido.estado === 'en_espera_cocina' || pedido.estado === 'en_cocina'

            return (
              <div
                key={pedido.id}
                className={cn(
                  'flex flex-col overflow-hidden rounded-xl border-2 bg-card transition-colors',
                  tomadoPorMi && 'border-primary/60 shadow-md',
                  tomadoPorOtro && 'border-blue-400/40',
                  pedido.estado === 'listo' && 'border-green-500/60',
                  !tomadoPorMi && !tomadoPorOtro && pedido.estado !== 'listo' && 'border-border',
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                  <div>
                    <p className="font-display text-lg font-bold leading-none">
                      {pedido.mesa_nombre || `Mesa #${pedido.mesa_id}`}
                      {pedido.es_qr && (
                        <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
                          QR cliente
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pedido #{pedido.numero_pedido || pedido.id.slice(0, 6)}
                      {' \u00b7 '}
                      {pedido.mesero_nombre || 'Sin mesero'}
                    </p>
                    {pedido.cocinero_nombre && (
                      <p className="mt-1 text-[11px] flex items-center gap-1 text-muted-foreground">
                        <UserCheck className="size-3" />
                        Cocinero: <span className="font-medium">{pedido.cocinero_nombre}</span>
                      </p>
                    )}
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
                      <span>Est: {tEst}m</span>
                      <button
                        onClick={() => abrirEditarTiempo(pedido)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Edit2 className="size-3" />
                      </button>
                    </div>
                    {minutos >= 10 && (
                      <Badge variant="destructive" className="text-[10px] animate-pulse">
                        Demorado
                      </Badge>
                    )}
                    {tiempoRestante > 0 && minutos < tEst && (
                      <Badge variant="outline" className="text-[10px] text-status-free">
                        {tiempoRestante}m restante
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      pedido.estado === 'listo'
                        ? 'bg-green-600/15 text-green-700'
                        : pedido.estado === 'en_preparacion'
                          ? tomadoPorMi
                            ? 'bg-primary/20 text-primary'
                            : 'bg-amber-500/20 text-amber-700'
                          : todosListos
                            ? 'bg-status-free/25 text-status-free'
                            : enProgreso
                              ? 'bg-status-bill/25 text-status-bill'
                              : 'bg-blue-500/15 text-blue-700',
                    )}>
                      {pedido.estado === 'listo'
                        ? 'Listo para entregar'
                        : pedido.estado === 'en_preparacion'
                          ? tomadoPorMi
                            ? 'Lo estas preparando tu'
                            : `En preparacion (${pedido.cocinero_nombre || 'asignado'})`
                          : todosListos
                            ? 'Items listos'
                            : enProgreso
                              ? 'En preparacion'
                              : sinAsignar ? 'Sin asignar - tomar pedido' : pedido.estado}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {items.filter((i: any) => i.estado === 'listo').length}/{items.length} listos
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {items.map((item: any, i: number) => {
                      const estaListo = item.estado === 'listo'
                      const puedeEditar =
                        pedido.estado === 'listo'
                          ? false
                          : pedido.cocinero_id
                            ? tomadoPorMi || user?.rol === 'dueno' || user?.rol === 'gerente'
                            : true
                      return (
                        <li key={i} className={cn(
                          'flex flex-col gap-0.5 rounded-lg p-2 transition-colors',
                          estaListo ? 'bg-status-free/10' : 'bg-muted/30'
                        )}>
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-lg font-bold text-primary tabular-nums">
                                {item.cantidad}x
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
                                className={cn(
                                  'h-7 px-2 text-xs transition-colors',
                                  puedeEditar
                                    ? 'border-green-500/50 text-green-600 hover:bg-green-500/10'
                                    : 'border-border text-muted-foreground opacity-60',
                                )}
                                onClick={() => puedeEditar && marcarItemListo(pedido.id, item.id, pedido)}
                                disabled={!puedeEditar}
                              >
                                <Check className="size-3 mr-1" />
                                Listo
                              </Button>
                            )}
                          </div>
                          {item.notas && (
                            <span className="ml-7 rounded bg-status-bill/15 px-2 py-0.5 text-xs font-medium text-status-bill">
                              {item.notas}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="p-3 border-t border-border flex flex-col gap-2">
                  {pedido.estado === 'listo' ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        size="lg"
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => marcarEntregado(pedido.id)}
                      >
                        <PackageCheck className="size-4 mr-2" />
                        Marcar como Entregado
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                          onClick={() => notificarClienteManual(pedido.id)}
                        >
                          <Megaphone className="size-3.5 mr-1.5" />
                          Volver a notificar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-dashed text-muted-foreground"
                          onClick={() => abrirEditarTiempo(pedido)}
                        >
                          <Edit2 className="size-3.5 mr-1.5" />
                          Ajustar tiempo
                        </Button>
                      </div>
                      <p className="text-[11px] text-center text-muted-foreground pt-1">
                        Toca Entregado cuando el cliente reciba la orden.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sinAsignar && !tomadoPorOtro && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-primary/50 text-primary hover:bg-primary/10"
                          onClick={() => tomarPedido(pedido.id)}
                        >
                          <UserCheck className="size-4 mr-2" />
                          Tomar para preparar
                        </Button>
                      )}
                      {tomadoPorMi && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => liberarPedido(pedido.id)}
                        >
                          <LogOut className="size-3 mr-1.5" />
                          Liberar pedido (otro cocinero lo toma)
                        </Button>
                      )}
                      {tomadoPorOtro && (
                        <p className="text-[11px] text-center text-blue-700 bg-blue-500/5 border border-blue-500/20 rounded-md py-1.5">
                          En preparacion por <span className="font-semibold">{pedido.cocinero_nombre}</span>
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-2">
                        <Button
                          size="lg"
                          className="w-full"
                          variant={todosListos ? 'default' : 'secondary'}
                          onClick={() => marcarPedidoListo(pedido)}
                          disabled={!todosListos || (tomadoPorOtro && user?.rol !== 'dueno' && user?.rol !== 'gerente')}
                        >
                          {todosListos ? (
                            <>
                              <Bell className="size-4 mr-2" />
                              Marcar LISTO y notificar
                            </>
                          ) : (
                            <>
                              <Clock className="size-4 mr-2" />
                              Esperando {items.filter((i: any) => i.estado !== 'listo').length} item(s) para marcar listo
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-green-600/40 text-green-800 hover:bg-green-500/10"
                          onClick={() => marcarEntregado(pedido.id)}
                        >
                          <HandCoins className="size-3.5 mr-1.5" />
                          Ya lo entregue - marcar directo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
                <span className="text-2xl font-bold w-16 text-center tabular-nums">{tiempoEstimado}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTiempoEstimado(tiempoEstimado + 1)}
                >
                  +
                </Button>
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {[5, 10, 15, 20, 30].map(n => (
                  <Button key={n} variant="outline" size="sm" onClick={() => setTiempoEstimado(n)}>
                    {n}m
                  </Button>
                ))}
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
