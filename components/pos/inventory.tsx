// components/pos/inventory.tsx - VERSIÓN CONECTADA
'use client'

import { useState, useEffect } from 'react'
import { Boxes, TriangleAlert, Search, Loader2, Plus, Edit2, Trash2 } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-context'

export function Inventory() {
  const { user } = useAuth()
  const [insumos, setInsumos] = useState<any[]>([])
  const [recetas, setRecetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [openNewInsumo, setOpenNewInsumo] = useState(false)
  const [insumoForm, setInsumoForm] = useState({
    nombre: '',
    unidad: 'kg',
    stock: '',
    stock_minimo: '',
    costo_unitario: '',
  })

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventario')
      const data = await res.json()
      if (res.ok) {
        setInsumos(data.insumos || [])
        setRecetas(data.recetas || [])
      } else {
        setError(data.error || 'Error al cargar inventario')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInsumo = async () => {
    if (!insumoForm.nombre.trim()) {
      alert('Ingresa el nombre del insumo')
      return
    }
    const res = await fetch('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insumoForm),
    })
    if (res.ok) {
      setOpenNewInsumo(false)
      setInsumoForm({ nombre: '', unidad: 'kg', stock: '', stock_minimo: '', costo_unitario: '' })
      await loadData()
    } else {
      const errData = await res.json()
      alert(errData.error || 'Error al crear insumo')
    }
  }

  const estadoInsumo = (i: any) => {
    if (i.stock <= i.stock_minimo * 0.5) return 'critico'
    if (i.stock <= i.stock_minimo) return 'bajo'
    return 'ok'
  }

  const estadoStyle = {
    ok: { label: 'En nivel', variant: 'secondary' as const },
    bajo: { label: 'Bajo', variant: 'default' as const },
    critico: { label: 'Crítico', variant: 'destructive' as const },
  }

  const filtrados = insumos.filter((i) =>
    i.nombre.toLowerCase().includes(query.toLowerCase())
  )
  const criticos = insumos.filter((i) => estadoInsumo(i) !== 'ok')

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
        <button onClick={loadData} className="mt-4 text-primary hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Boxes className="size-6 text-primary" />
            Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            {insumos.length} insumos · {recetas.length} recetas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>Actualizar</Button>
          <Button onClick={() => setOpenNewInsumo(true)}><Plus className="size-4" /> Nuevo insumo</Button>
        </div>
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
                  const pct = Math.min(100, Math.round((i.stock / (i.stock_minimo * 2)) * 100))
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
                        <span className="ml-1 text-xs text-muted-foreground">/ min {i.stock_minimo}</span>
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
            <CardTitle className="text-base">Recetas</CardTitle>
            <CardDescription>Escandallo de insumos por platillo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
            {recetas.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No hay recetas registradas
              </p>
            ) : (
              recetas.map((r) => (
                <div key={r.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {r.producto_nombre || `Producto #${r.producto_id}`}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {(r.items || []).map((item: any, i: number) => (
                      <li key={i} className="flex justify-between text-sm text-muted-foreground">
                        <span>{item.insumo_nombre}</span>
                        <span className="tabular-nums text-foreground">
                          {item.cantidad} {item.unidad}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Nuevo Insumo */}
      <Dialog open={openNewInsumo} onOpenChange={setOpenNewInsumo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo insumo</DialogTitle>
            <DialogDescription>Registra un nuevo ingrediente o insumo para inventario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                placeholder="Ej. Tomate Bola, Queso Gouda"
                value={insumoForm.nombre}
                onChange={(e) => setInsumoForm({ ...insumoForm, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Unidad de medida</label>
                <Input
                  placeholder="kg, L, piezas, g"
                  value={insumoForm.unidad}
                  onChange={(e) => setInsumoForm({ ...insumoForm, unidad: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Costo unitario ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={insumoForm.costo_unitario}
                  onChange={(e) => setInsumoForm({ ...insumoForm, costo_unitario: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Existencia actual</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={insumoForm.stock}
                  onChange={(e) => setInsumoForm({ ...insumoForm, stock: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Stock mínimo alerta</label>
                <Input
                  type="number"
                  placeholder="5"
                  value={insumoForm.stock_minimo}
                  onChange={(e) => setInsumoForm({ ...insumoForm, stock_minimo: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewInsumo(false)}>Cancelar</Button>
            <Button onClick={handleCreateInsumo}>Guardar insumo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}