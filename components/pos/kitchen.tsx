'use client'

import { useState } from 'react'
import { Clock, Check, CircleCheckBig, ChefHat } from 'lucide-react'

import { type PedidoCocina, pedidosCocina } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Color del temporizador según minutos transcurridos.
function timerStyle(minutos: number) {
  if (minutos >= 15) return 'bg-destructive text-white'
  if (minutos >= 8) return 'bg-status-bill text-status-bill-foreground'
  return 'bg-status-free text-status-free-foreground'
}

function estadoBadge(estado: PedidoCocina['estado']) {
  switch (estado) {
    case 'nuevo':
      return { label: 'Nuevo', className: 'bg-primary text-primary-foreground' }
    case 'preparando':
      return { label: 'Preparando', className: 'bg-status-bill/25 text-status-bill' }
    case 'listo':
      return { label: 'Listo', className: 'bg-status-free/25 text-status-free' }
  }
}

export function Kitchen() {
  const [pedidos, setPedidos] = useState<PedidoCocina[]>(pedidosCocina)

  const marcarListo = (id: string) => {
    setPedidos((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChefHat className="size-4 text-primary" />
          <span>
            <span className="font-medium text-foreground tabular-nums">{pedidos.length}</span>{' '}
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

      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-24 text-center">
          <CircleCheckBig className="size-10 text-status-free" />
          <p className="font-display text-lg font-semibold">¡Todo al día!</p>
          <p className="text-sm text-muted-foreground">No hay comandas pendientes en cocina.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pedidos.map((pedido) => {
            const badge = estadoBadge(pedido.estado)
            return (
              <div
                key={pedido.id}
                className="flex flex-col overflow-hidden rounded-xl border-2 border-border bg-card"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                  <div>
                    <p className="font-display text-lg font-bold leading-none">{pedido.mesa}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pedido.id} · {pedido.mesero}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums',
                      timerStyle(pedido.minutos),
                    )}
                  >
                    <Clock className="size-4" />
                    {pedido.minutos}:00
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <span
                    className={cn(
                      'w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                  <ul className="flex flex-col gap-2.5">
                    {pedido.items.map((item, i) => (
                      <li key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-lg font-bold text-primary tabular-nums">
                            {item.cantidad}×
                          </span>
                          <span className="text-base font-medium leading-tight">
                            {item.nombre}
                          </span>
                        </div>
                        {item.nota && (
                          <span className="ml-7 rounded bg-status-bill/15 px-2 py-0.5 text-xs font-medium text-status-bill">
                            {item.nota}
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
                    onClick={() => marcarListo(pedido.id)}
                  >
                    <Check data-icon="inline-start" />
                    Marcar como listo
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
