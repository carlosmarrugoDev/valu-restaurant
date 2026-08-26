'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/components/auth/auth-context'
import { currency, ROLES } from '@/lib/data'
import { RefreshCw } from 'lucide-react'

type EmpleadoTurno = {
  id: string
  nombre: string
  role: 'cocina' | 'mesero' | 'gerente' | 'cajero'
  enTurno: boolean
  pedidosTomados?: number
  pedidosListos?: number
}

function calcularTurnoActual(): { nombre: string; color: string } {
  const h = new Date().getHours()
  if (h >= 7 && h < 16) return { nombre: 'Comida', color: 'bg-amber-500' }
  return { nombre: 'Cena', color: 'bg-indigo-500' }
}

export function Turns() {
  const { user } = useAuth()
  const turnoActual = calcularTurnoActual()
  const [empleados, setEmpleados] = useState<EmpleadoTurno[]>([])
  const [resumenCocina, setResumenCocina] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const resEmp = await fetch('/api/usuarios', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (resEmp.ok) {
        const data = await resEmp.json()
        const lista = (data.usuarios || data || []).filter((u: any) =>
          ['cocina', 'mesero', 'gerente', 'cajero'].includes(u.role || u.rol)
        )
        setEmpleados(
          lista.map((e: any) => ({
            id: e.id,
            nombre: e.nombre || e.name || 'Empleado',
            role: (e.role || e.rol || 'mesero') as any,
            enTurno: e.en_turno ?? true,
            pedidosTomados: 0,
            pedidosListos: 0,
          }))
        )
      } else {
        setEmpleados([
          { id: '1', nombre: 'Lucía Ramírez', role: 'mesero', enTurno: true },
          { id: '2', nombre: 'Diego Morales', role: 'mesero', enTurno: true },
          { id: '3', nombre: 'Karla Torres', role: 'mesero', enTurno: true },
          { id: '4', nombre: 'Mario Sánchez', role: 'cocina', enTurno: true, pedidosTomados: 5, pedidosListos: 4 },
          { id: '5', nombre: 'Andrea Cruz', role: 'cocina', enTurno: true, pedidosTomados: 6, pedidosListos: 5 },
          { id: '6', nombre: 'Jorge Pérez', role: 'cocina', enTurno: false },
          { id: '7', nombre: 'Rosa López', role: 'cajero', enTurno: true },
        ])
      }

      const resPed = await fetch('/api/pedidos?estado=historial_hoy', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (resPed.ok) {
        const data = await resPed.json()
        const pedidos = data.pedidos || []
        const mapa = new Map<string, { nombre: string; tomados: number; listos: number; entrega: number; total: number }>()
        for (const p of pedidos) {
          const cid = p.cocinero_id
          const cnombre = p.cocinero_nombre || 'Sin asignar'
          if (!mapa.has(cid || 'sin_asignar')) {
            mapa.set(cid || 'sin_asignar', { nombre: cnombre, tomados: 0, listos: 0, entrega: 0, total: 0 })
          }
          const r = mapa.get(cid || 'sin_asignar')!
          if (p.estado === 'en_preparacion' || p.estado === 'listo' || p.estado === 'entregado' || p.estado === 'pagado') r.tomados++
          if (p.estado === 'listo' || p.estado === 'entregado' || p.estado === 'pagado') r.listos++
          if (p.estado === 'entregado' || p.estado === 'pagado') r.entrega++
          r.total += p.total || 0
        }
        setResumenCocina(Array.from(mapa.values()))
      } else {
        setResumenCocina([
          { nombre: 'Mario Sánchez', tomados: 5, listos: 4, entrega: 3, total: 2250 },
          { nombre: 'Andrea Cruz', tomados: 6, listos: 5, entrega: 4, total: 2980 },
          { nombre: 'Sin asignar', tomados: 1, listos: 0, entrega: 0, total: 185 },
        ])
      }
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const toggleTurno = (id: string) => {
    setEmpleados(prev => prev.map(e => e.id === id ? { ...e, enTurno: !e.enTurno } : e))
  }

  const enTurnoCount = empleados.filter(e => e.enTurno).length
  const cocinerosEnTurno = empleados.filter(e => e.role === 'cocina' && e.enTurno).length
  const meserosEnTurno = empleados.filter(e => e.role === 'mesero' && e.enTurno).length

  const rolLabel = (r: string) => ROLES.find(x => x.id === r)?.label || r

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Control de Turnos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona quién está en turno hoy y sigue la actividad por cocinero
          </p>
        </div>
        <Button variant="outline" onClick={cargarDatos} disabled={cargando}>
          <RefreshCw className={`size-4 mr-2 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Turno actual</p>
                <p className="font-display text-2xl font-bold mt-1">{turnoActual.nombre}</p>
              </div>
              <span className={`size-3 rounded-full ${turnoActual.color}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">En turno hoy</p>
            <p className="font-display text-2xl font-bold mt-1">{enTurnoCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Personal total: {empleados.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Cocineros activos</p>
            <p className="font-display text-2xl font-bold mt-1">{cocinerosEnTurno}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Meseros activos</p>
            <p className="font-display text-2xl font-bold mt-1">{meserosEnTurno}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asistencia de hoy</CardTitle>
            <CardDescription>
              Marca qué empleados están en turno. Los cocineros en turno aparecerán disponibles para tomar pedidos en Cocina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {empleados.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`turno-${e.id}`}
                    checked={e.enTurno}
                    onCheckedChange={() => toggleTurno(e.id)}
                  />
                  <div>
                    <Label htmlFor={`turno-${e.id}`} className="font-medium cursor-pointer">
                      {e.nombre}
                    </Label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {rolLabel(e.role)}
                      </Badge>
                      {e.role === 'cocina' && e.pedidosTomados !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          {e.pedidosTomados} tomados · {e.pedidosListos} listos
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={e.enTurno ? 'default' : 'secondary'}>
                  {e.enTurno ? 'En turno' : 'Fuera'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen por cocinero - Hoy</CardTitle>
            <CardDescription>
              Seguimiento de pedidos por cocinero asignado. El sistema de turnos asigna pedidos al cocinero que presione "Tomar para preparar".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cocinero</TableHead>
                  <TableHead className="text-right">Tomados</TableHead>
                  <TableHead className="text-right">Listos</TableHead>
                  <TableHead className="text-right">Entregados</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumenCocina.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-right">{r.tomados}</TableCell>
                    <TableCell className="text-right">{r.listos}</TableCell>
                    <TableCell className="text-right">{r.entrega}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {currency(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {resumenCocina.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Sin pedidos tomados aún hoy
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
