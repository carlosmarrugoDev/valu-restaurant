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
  role: 'cocina' | 'mesero' | 'gerente' | 'cajero' | 'dueno' | 'admin'
  enTurno: boolean
  pedidosTomados?: number
  pedidosListos?: number
  pedidosEntregados?: number
}

function calcularTurnoActual(): { nombre: string; color: string } {
  const h = new Date().getHours()
  if (h >= 7 && h < 16) return { nombre: 'Comida', color: 'bg-amber-500' }
  return { nombre: 'Cena', color: 'bg-indigo-500' }
}

function hoyKey() {
  return new Date().toISOString().split('T')[0]
}

function loadTurnosLocales(tenantId?: string): Record<string, boolean> {
  try {
    const key = `turnos_${tenantId || 'default'}_${hoyKey()}`
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveTurnosLocales(tenantId: string | undefined, map: Record<string, boolean>) {
  try {
    const key = `turnos_${tenantId || 'default'}_${hoyKey()}`
    localStorage.setItem(key, JSON.stringify(map))
  } catch { /* no-op */ }
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
      const turnosMap = loadTurnosLocales(user?.tenantId)

      const resEmp = await fetch('/api/empleados', {
        headers: { 'Content-Type': 'application/json' },
      })
      let listaEmpleados: any[] = []
      if (resEmp.ok) {
        const data = await resEmp.json()
        listaEmpleados = (data.empleados || data || []).filter((u: any) => u.activo !== false)
        if (user && listaEmpleados.findIndex((e: any) => e.id === user.id) === -1) {
          listaEmpleados.unshift({
            id: user.id,
            nombre: user.nombre || user.email || 'Yo',
            rol: user.rol || 'dueno',
          })
        }
      } else {
        const resEmp2 = await fetch('/api/empleados', {
          headers: { 'Content-Type': 'application/json' },
        })
        if (resEmp2.ok) {
          const data = await resEmp2.json()
          listaEmpleados = (data.empleados || data || []).filter((u: any) => u.activo !== false)
        }
      }

      const resPed = await fetch('/api/pedidos?estado=historial_hoy', {
        headers: { 'Content-Type': 'application/json' },
      })
      const pedidos: any[] = []
      const statsMap = new Map<string, { tomados: number; listos: number; entrega: number; total: number }>()
      if (resPed.ok) {
        const data = await resPed.json()
        const ps = data.pedidos || []
        ps.forEach((p: any) => pedidos.push(p))

        for (const p of pedidos) {
          const cid = p.cocinero_id
          const cnombre = p.cocinero_nombre || (cid ? null : 'Sin asignar')
          if (cid || cnombre === 'Sin asignar') {
            const key = cid || 'sin_asignar'
            if (!statsMap.has(key)) {
              statsMap.set(key, { tomados: 0, listos: 0, entrega: 0, total: 0 })
            }
            const r = statsMap.get(key)!
            const estadosTomado = ['en_cocina', 'en_preparacion', 'listo', 'entregado', 'pagado']
            if (estadosTomado.includes(p.estado)) r.tomados++
            if (['listo', 'entregado', 'pagado'].includes(p.estado)) r.listos++
            if (['entregado', 'pagado'].includes(p.estado)) r.entrega++
            r.total += p.total || 0
          }
        }
      }

      setEmpleados(
        listaEmpleados.map((e: any) => {
          const rol = (e.rol || e.role || 'mesero') as any
          const stats = e.id ? statsMap.get(e.id) : undefined
          return {
            id: e.id,
            nombre: e.nombre || e.name || 'Empleado',
            role: rol,
            enTurno: Object.prototype.hasOwnProperty.call(turnosMap, e.id)
              ? !!turnosMap[e.id]
              : (e.en_turno ?? true),
            pedidosTomados: stats?.tomados || 0,
            pedidosListos: stats?.listos || 0,
            pedidosEntregados: stats?.entrega || 0,
          }
        })
      )

      const resumen: any[] = []
      const nombrePorId: Record<string, string> = {}
      listaEmpleados.forEach((e: any) => { nombrePorId[e.id] = e.nombre || 'Empleado' })
      statsMap.forEach((value, key) => {
        resumen.push({
          id: key,
          nombre: key === 'sin_asignar' ? 'Sin asignar' : (nombrePorId[key] || 'Sin asignar'),
          tomados: value.tomados,
          listos: value.listos,
          entrega: value.entrega,
          total: value.total,
        })
      })
      resumen.sort((a, b) => a.nombre === 'Sin asignar' ? 1 : b.nombre === 'Sin asignar' ? -1 : a.tomados - b.tomados)
      setResumenCocina(resumen)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [user])

  const toggleTurno = (id: string) => {
    setEmpleados(prev => {
      const next = prev.map(e => e.id === id ? { ...e, enTurno: !e.enTurno } : e)
      const map: Record<string, boolean> = {}
      next.forEach(e => { map[e.id] = e.enTurno })
      saveTurnosLocales(user?.tenantId, map)
      return next
    })
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
            {empleados.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                No se pudo cargar el personal. Verifica la conexión.
              </p>
            )}
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
                      {e.role === 'cocina' && (
                        <span className="text-[10px] text-muted-foreground">
                          {e.pedidosTomados} tomados · {e.pedidosListos} listos · {e.pedidosEntregados} entregados
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
                  <TableRow key={r.id || i}>
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
