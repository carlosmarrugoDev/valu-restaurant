'use client'

import { useState } from 'react'
import { Plus, Clock, User, Receipt, Armchair } from 'lucide-react'

import {
  type EstadoMesa,
  type Mesa,
  currencyDetailed,
  estadoMesaLabel,
  mesas,
} from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const estadoStyles: Record<EstadoMesa, string> = {
  libre: 'border-status-free/40 bg-status-free/12 text-status-free hover:bg-status-free/20',
  ocupada:
    'border-status-occupied/40 bg-status-occupied/15 text-status-occupied hover:bg-status-occupied/25',
  cuenta: 'border-status-bill/40 bg-status-bill/15 text-status-bill hover:bg-status-bill/25',
  reservada:
    'border-status-reserved/50 bg-status-reserved/15 text-status-reserved hover:bg-status-reserved/25',
}

const dotStyles: Record<EstadoMesa, string> = {
  libre: 'bg-status-free',
  ocupada: 'bg-status-occupied',
  cuenta: 'bg-status-bill',
  reservada: 'bg-status-reserved',
}

const leyenda: EstadoMesa[] = ['libre', 'ocupada', 'cuenta', 'reservada']

const resumen = leyenda.map((estado) => ({
  estado,
  count: mesas.filter((m) => m.estado === estado).length,
}))

export function TablesMap() {
  const [selected, setSelected] = useState<Mesa | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {resumen.map(({ estado, count }) => (
            <div key={estado} className="flex items-center gap-2 text-sm">
              <span className={cn('size-2.5 rounded-full', dotStyles[estado])} />
              <span className="text-muted-foreground">{estadoMesaLabel[estado]}</span>
              <span className="font-medium tabular-nums">{count}</span>
            </div>
          ))}
        </div>
        <Button>
          <Plus data-icon="inline-start" />
          Nueva mesa
        </Button>
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {mesas.map((mesa) => (
              <button
                key={mesa.id}
                type="button"
                onClick={() => setSelected(mesa)}
                className={cn(
                  'group relative flex aspect-4/3 flex-col items-center justify-center gap-1.5 border p-3 transition-colors',
                  mesa.forma === 'circulo' ? 'rounded-full' : 'rounded-xl',
                  estadoStyles[mesa.estado],
                )}
              >
                <span className="font-display text-sm font-semibold text-foreground">
                  {mesa.nombre}
                </span>
                <span className="flex items-center gap-1 text-xs opacity-90">
                  <Armchair className="size-3.5" />
                  {mesa.asientos}
                </span>
                {mesa.estado !== 'libre' && mesa.minutos !== undefined && (
                  <span className="flex items-center gap-1 text-[11px] font-medium">
                    <Clock className="size-3" />
                    {mesa.minutos} min
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="font-display text-lg">{selected.nombre}</DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn('gap-1.5', estadoStyles[selected.estado])}
                  >
                    <span className={cn('size-2 rounded-full', dotStyles[selected.estado])} />
                    {estadoMesaLabel[selected.estado]}
                  </Badge>
                </div>
                <DialogDescription>
                  Capacidad para {selected.asientos}{' '}
                  {selected.asientos === 1 ? 'persona' : 'personas'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-4" /> Mesero asignado
                  </span>
                  <span className="font-medium">{selected.mesero ?? 'Sin asignar'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" /> Tiempo ocupada
                  </span>
                  <span className="font-medium">
                    {selected.minutos !== undefined ? `${selected.minutos} min` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Receipt className="size-4" /> Cuenta actual
                  </span>
                  <span className="font-display text-base font-semibold text-primary">
                    {selected.total ? currencyDetailed(selected.total) : '—'}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
                <Button>
                  {selected.estado === 'libre' ? 'Abrir mesa' : 'Ver pedido'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
