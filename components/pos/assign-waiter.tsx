'use client'

import { useState, useEffect } from 'react'
import { Users, UserCheck, Loader2, RefreshCw, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'

export function AssignWaiter() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [mesas, setMesas] = useState<any[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [asignaciones, setAsignaciones] = useState<any[]>([])
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [mesasRes, empRes, asigRes] = await Promise.all([
        fetch('/api/mesas'),
        fetch('/api/empleados'),
        fetch('/api/asignaciones?activas=true'),
      ])
      const mesasData = await mesasRes.json()
      const empData = await empRes.json()
      const asigData = await asigRes.json()

      setMesas(mesasData.mesas || [])
      setEmpleados(empData.empleados?.filter((e: any) => e.rol === 'mesero') || [])
      setAsignaciones(asigData.asignaciones || [])

      // Inicializar selecciones
      const selec: Record<string, string> = {}
      for (const asig of (asigData.asignaciones || [])) {
        selec[asig.mesa_id] = asig.usuario_id
      }
      setSeleccion(selec)
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (mesaId: string, usuarioId: string) => {
    setSaving(mesaId)
    try {
      const res = await fetch('/api/asignaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: mesaId,
          usuario_id: usuarioId,
          turno: 'tarde',
        }),
      })
      if (res.ok) {
        toast.success('Mesero asignado correctamente')
        setSeleccion({ ...seleccion, [mesaId]: usuarioId })
        await loadData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al asignar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(null)
    }
  }

  const handleUnassign = async (mesaId: string) => {
    const asignacion = asignaciones.find(a => a.mesa_id === mesaId && a.activa)
    if (!asignacion) return

    setSaving(mesaId)
    try {
      const res = await fetch(`/api/asignaciones?id=${asignacion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: false }),
      })
      if (res.ok) {
        toast.success('Mesero desasignado')
        const newSelec = { ...seleccion }
        delete newSelec[mesaId]
        setSeleccion(newSelec)
        await loadData()
      }
    } catch {
      toast.error('Error al desasignar')
    } finally {
      setSaving(null)
    }
  }

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
            <Users className="size-6 text-primary" />
            Asignar meseros
          </h1>
          <p className="text-sm text-muted-foreground">
            Asigna meseros a mesas para el turno actual
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="size-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {empleados.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-600">
          No hay meseros registrados. Ve a "Personal" y crea uno primero.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mesas.map((mesa) => {
          const meseroId = seleccion[mesa.id] || ''
          const mesero = empleados.find(e => e.id === meseroId)
          const estaAsignado = !!meseroId

          return (
            <Card key={mesa.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{mesa.nombre}</CardTitle>
                  <Badge variant={estaAsignado ? 'default' : 'outline'}>
                    {estaAsignado ? 'Asignada' : 'Sin asignar'}
                  </Badge>
                </div>
                <CardDescription>
                  {mesa.zona || 'Sin zona'} · {mesa.asientos} asientos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Mesero asignado</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Select
                        value={meseroId || ''}
                        onValueChange={(v) => v && handleAssign(mesa.id, v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Seleccionar mesero" />
                        </SelectTrigger>
                        <SelectContent>
                          {empleados.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nombre} {e.email && `(${e.email})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {estaAsignado && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-10 w-10"
                          onClick={() => handleUnassign(mesa.id)}
                          disabled={saving === mesa.id}
                        >
                          {saving === mesa.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <X className="size-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {mesero && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                      <UserCheck className="size-4 text-primary" />
                      <span>{mesero.nombre} · {mesero.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}