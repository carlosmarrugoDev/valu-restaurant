'use client'

import { Boxes, TriangleAlert, Search } from 'lucide-react'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { insumos, estadoInsumo, recetas } from '@/lib/data'
import { cn } from '@/lib/utils'

const estadoStyle = {
  ok: { label: 'En nivel', variant: 'secondary' as const },
  bajo: { label: 'Bajo', variant: 'default' as const },
  critico: { label: 'Crítico', variant: 'destructive' as const },
}

export function Inventory() {
  const [query, setQuery] = useState('')
  const filtrados = insumos.filter((i) => i.nombre.toLowerCase().includes(query.toLowerCase()))
  const criticos = insumos.filter((i) => estadoInsumo(i) !== 'ok')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">Control de insumos, mínimos y recetas</p>
      </div>

      {criticos.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{criticos.length} insumos requieren reabastecimiento</AlertTitle>
          <AlertDescription>
            {criticos.map((c) => c.nombre).join(', ')} están por debajo del nivel mínimo.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Tabla de insumos */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Boxes className="size-4 text-primary" />
                  Insumos
                </CardTitle>
                <CardDescription>Existencias actuales</CardDescription>
              </div>
              <div className="relative w-full max-w-56">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar insumo..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="w-40">Nivel</TableHead>
                  <TableHead className="text-right">Existencia</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((i) => {
                  const estado = estadoInsumo(i)
                  const pct = Math.min(100, Math.round((i.stock / (i.minimo * 2)) * 100))
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nombre}</TableCell>
                      <TableCell>
                        <Progress
                          value={pct}
                          className={cn(
                            'h-2',
                            estado === 'critico' && '[&>*]:bg-destructive',
                            estado === 'bajo' && '[&>*]:bg-primary',
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.stock} {i.unidad}
                        <span className="ml-1 text-xs text-muted-foreground">/ min {i.minimo}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={estadoStyle[estado].variant}>{estadoStyle[estado].label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recetas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recetas estándar</CardTitle>
            <CardDescription>Escandallo de insumos por platillo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recetas.map((r) => (
              <div key={r.platillo} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="mb-2 text-sm font-semibold">{r.platillo}</p>
                <ul className="flex flex-col gap-1.5">
                  {r.insumos.map((ing) => (
                    <li key={ing.nombre} className="flex justify-between text-sm text-muted-foreground">
                      <span>{ing.nombre}</span>
                      <span className="tabular-nums text-foreground">{ing.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
