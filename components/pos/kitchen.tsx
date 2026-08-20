// components/pos/kitchen.tsx - VERSIÓN CONECTADA
'use client'

import { useState, useEffect } from 'react'
import { Clock, Check, CircleCheckBig, ChefHat, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/auth-context'

function timerStyle(minutos: number) {
  if (minutos >= 15) return 'bg-destructive text-white'
  if (minutos >= 8) return 'bg-status-bill text-status-bill-foreground'
  return 'bg-status-free text-status-free-foreground'
}

export function Kitchen() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPedidos()
    const interval = setInterval(loadPedidos, 10000) // Refresh cada 10 segundos
    return () => clearInterval(interval)
  }, [user])

  const loadPedidos = async () => {
    try {
      const res = await fetch('/api/cocina')
      const data = await res.json()
      if (res.ok) {
        setPedidos(data.pedidos || [])
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

  const marcarListo = async (id: string, tipo: 'pedido' | 'item', itemId?: string) => {
    try {
      const body = tipo === 'pedido'
        ? { pedido_id: id, tipo: 'pedido' }
        : { item_id: itemId, tipo: 'item' }
      const res = await fetch('/api/cocina', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await loadPedidos()
      }
    } catch {
      // ignore
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

  const pedidosActivos = pedidos.filter(p => p.estado !== 'listo' && p.estado !== 'entregado')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChefHat className="size-4 text-primary" />
          <span>
            <span className="font-medium text-foreground tabular-nums">{pedidosActivos.length}</span>
            comandas en preparación
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-free" /> A tiempo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-bill" /> Demorado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive" /> Crítico
          </span>
        </div>
      </div>

      {pedidosActivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-24 text-center">
          <CircleCheckBig className="size-10 text-status-free" />
          <p className="font-display text-lg font-semibold">¡Todo al día!</p>
          <p className="text-sm text-muted-foreground">No hay comandas pendientes en cocina.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pedidosActivos.map((pedido) => {
            const items = pedido.items || []
            const todosListos = items.every((i: any) => i.estado === 'listo')
            const enProgreso = items.some((i: any) => i.estado === 'en_cocina')

            return (
              <div key={pedido.id} className="flex flex-col overflow-hidden rounded-xl border-2 border-border bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                  <div>
                    <p className="font-display text-lg font-bold leading-none">
                      {pedido.mesa_nombre || `Mesa #${pedido.mesa_id}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pedido #{pedido.numero_pedido} · {pedido.mesero_nombre || 'Sin mesero'}
                    </p>
                  </div>
                  <span className={cn(
                    'flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums',
                    timerStyle(pedido.segundos_transcurridos ? Math.floor(pedido.segundos_transcurridos / 60) : 0),
                  )}>
                    <Clock className="size-4" />
                    {pedido.segundos_transcurridos ? Math.floor(pedido.segundos_transcurridos / 60) : 0}m
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <span className={cn(
                    'w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    todosListos ? 'bg-status-free/25 text-status-free' :
                    enProgreso ? 'bg-status-bill/25 text-status-bill' :
                    'bg-primary/25 text-primary',
                  )}>
                    {todosListos ? 'Listo' : enProgreso ? 'En preparación' : 'Pendiente'}
                  </span>
                  <ul className="flex flex-col gap-2.5">
                    {items.map((item: any, i: number) => (
                      <li key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-lg font-bold text-primary tabular-nums">
                              {item.cantidad}×
                            </span>
                            <span className="text-base font-medium leading-tight">
                              {item.nombre_producto}
                            </span>
                          </div>
                          {item.estado === 'listo' ? (
                            <Check className="size-4 text-status-free" />
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => marcarListo(pedido.id, 'item', item.id)}
                            >
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
                    ))}
                  </ul>
                </div>

                <div className="p-3">
                  <Button
                    size="lg"
                    className="w-full bg-status-free text-status-free-foreground hover:bg-status-free/90"
                    onClick={() => marcarListo(pedido.id, 'pedido')}
                    disabled={items.some((i: any) => i.estado !== 'listo')}
                  >
                    <Check data-icon="inline-start" />
                    Marcar todo como listo
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}