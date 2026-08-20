// components/pos/tables-map.tsx - VERSIÓN CONECTADA
'use client'

import { useState, useEffect } from 'react'
import { Plus, Clock, User, Receipt, Armchair, Loader2 } from 'lucide-react'

import { currencyDetailed } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/components/auth/auth-context'

const estadoStyles: Record<string, string> = {
  libre: 'border-status-free/40 bg-status-free/12 text-status-free hover:bg-status-free/20',
  ocupada: 'border-status-occupied/40 bg-status-occupied/15 text-status-occupied hover:bg-status-occupied/25',
  cuenta: 'border-status-bill/40 bg-status-bill/15 text-status-bill hover:bg-status-bill/25',
  reservada: 'border-status-reserved/50 bg-status-reserved/15 text-status-reserved hover:bg-status-reserved/25',
}

const dotStyles: Record<string, string> = {
  libre: 'bg-status-free',
  ocupada: 'bg-status-occupied',
  cuenta: 'bg-status-bill',
  reservada: 'bg-status-reserved',
}

const estadoLabel: Record<string, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  cuenta: 'Cuenta pedida',
  reservada: 'Reservada',
}

export function TablesMap() {
  const { user } = useAuth()
  const [mesas, setMesas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [openNewMesa, setOpenNewMesa] = useState(false)
  const [newMesaForm, setNewMesaForm] = useState({
    nombre: '',
    asientos: 4,
    forma: 'cuadro',
    zona: 'Salón principal',
  })

  useEffect(() => {
    loadMesas()
  }, [user])

  const loadMesas = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mesas')
      const data = await res.json()
      if (res.ok) {
        setMesas(data.mesas || [])
      } else {
        setError(data.error || 'Error al cargar mesas')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMesa = async () => {
    if (!newMesaForm.nombre.trim()) {
      alert('Ingresa el nombre de la mesa')
      return
    }
    const res = await fetch('/api/mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMesaForm),
    })
    if (res.ok) {
      setOpenNewMesa(false)
      setNewMesaForm({ nombre: '', asientos: 4, forma: 'cuadro', zona: 'Salón principal' })
      await loadMesas()
    } else {
      const errData = await res.json()
      alert(errData.error || 'Error al crear mesa')
    }
  }

  const resumen = [
    { estado: 'libre', count: mesas.filter((m) => m.estado === 'libre').length },
    { estado: 'ocupada', count: mesas.filter((m) => m.estado === 'ocupada').length },
    { estado: 'cuenta', count: mesas.filter((m) => m.estado === 'cuenta').length },
    { estado: 'reservada', count: mesas.filter((m) => m.estado === 'reservada').length },
  ]

  const handleUpdateEstado = async (id: string, estado: string) => {
    const res = await fetch(`/api/mesas?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    if (res.ok) {
      await loadMesas()
      setSelected(null)
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
        <button onClick={loadMesas} className="mt-4 text-primary hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {resumen.map(({ estado, count }) => (
            <div key={estado} className="flex items-center gap-2 text-sm">
              <span className={cn('size-2.5 rounded-full', dotStyles[estado])} />
              <span className="text-muted-foreground">{estadoLabel[estado]}</span>
              <span className="font-medium tabular-nums">{count}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => setOpenNewMesa(true)}>
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
                  estadoStyles[mesa.estado] || estadoStyles.libre,
                )}
              >
                <span className="font-display text-sm font-semibold text-foreground">
                  {mesa.nombre}
                </span>
                <span className="flex items-center gap-1 text-xs opacity-90">
                  <Armchair className="size-3.5" />
                  {mesa.asientos}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Nueva Mesa */}
      <Dialog open={openNewMesa} onOpenChange={setOpenNewMesa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva mesa</DialogTitle>
            <DialogDescription>Agrega una mesa al mapa de tu restaurante</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre de la mesa</label>
              <input
                type="text"
                placeholder="Ej. Mesa 7, Terraza 2"
                className="w-full mt-1 p-2 rounded-md border bg-background text-sm"
                value={newMesaForm.nombre}
                onChange={(e) => setNewMesaForm({ ...newMesaForm, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Asientos</label>
                <input
                  type="number"
                  min="1"
                  className="w-full mt-1 p-2 rounded-md border bg-background text-sm"
                  value={newMesaForm.asientos}
                  onChange={(e) => setNewMesaForm({ ...newMesaForm, asientos: Number(e.target.value) || 2 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Forma</label>
                <select
                  className="w-full mt-1 p-2 rounded-md border bg-background text-sm"
                  value={newMesaForm.forma}
                  onChange={(e) => setNewMesaForm({ ...newMesaForm, forma: e.target.value })}
                >
                  <option value="cuadro">Cuadrada / Rectangular</option>
                  <option value="circulo">Circular</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Zona / Área</label>
              <input
                type="text"
                placeholder="Ej. Salón principal, Barra, Terraza"
                className="w-full mt-1 p-2 rounded-md border bg-background text-sm"
                value={newMesaForm.zona}
                onChange={(e) => setNewMesaForm({ ...newMesaForm, zona: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewMesa(false)}>Cancelar</Button>
            <Button onClick={handleCreateMesa}>Crear mesa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Mesa */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="font-display text-lg">{selected.nombre}</DialogTitle>
                  <Badge variant="outline" className={cn('gap-1.5', estadoStyles[selected.estado])}>
                    <span className={cn('size-2 rounded-full', dotStyles[selected.estado])} />
                    {estadoLabel[selected.estado]}
                  </Badge>
                </div>
                <DialogDescription>
                  Capacidad para {selected.asientos} {selected.asientos === 1 ? 'persona' : 'personas'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-4" /> Mesero asignado
                  </span>
                  <span className="font-medium">{selected.mesero_nombre || 'Sin asignar'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" /> Estado
                  </span>
                  <span className="font-medium">{estadoLabel[selected.estado]}</span>
                </div>
              </div>

              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
                {selected.estado === 'libre' && (
                  <Button onClick={() => handleUpdateEstado(selected.id, 'ocupada')}>
                    Abrir mesa
                  </Button>
                )}
                {selected.estado === 'ocupada' && (
                  <Button onClick={() => handleUpdateEstado(selected.id, 'cuenta')}>
                    Pedir cuenta
                  </Button>
                )}
                {selected.estado !== 'libre' && selected.estado !== 'reservada' && (
                  <Button variant="secondary" onClick={() => handleUpdateEstado(selected.id, 'libre')}>
                    Liberar mesa
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}