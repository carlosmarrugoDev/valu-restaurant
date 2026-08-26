'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Banknote, CreditCard, Smartphone,
  Printer, Receipt, Loader2, CheckCircle, Users,
  Undo2, RefreshCw,
} from 'lucide-react'

import { currencyDetailed } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'

const IVA = 0.16
const propinaOpciones = [0, 10, 15, 20]

const metodos = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'digital', label: 'Digital', icon: Smartphone },
]

export function Checkout() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [personas, setPersonas] = useState(1)
  const [propina, setPropina] = useState(10)
  const [metodo, setMetodo] = useState('tarjeta')
  const [procesando, setProcesando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)

  useEffect(() => {
    loadPedidos()
    loadHistorial()
  }, [user])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pedidos?estado=listo')
      const data = await res.json()
      if (res.ok) {
        const pedidosPendientes = (data.pedidos || []).filter((p: any) => !p.metodo_pago)
        setPedidos(pedidosPendientes)
        if (pedidosPendientes.length > 0 && (!pedidoSeleccionado || !pedidosPendientes.find((p: any) => p.id === pedidoSeleccionado.id))) {
          setPedidoSeleccionado(pedidosPendientes[0])
        } else if (pedidosPendientes.length === 0) {
          setPedidoSeleccionado(null)
        }
      }
    } catch {
      toast.error('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }

  const loadHistorial = async () => {
    try {
      const res = await fetch('/api/pedidos?estado=pagado&limit=20')
      const data = await res.json()
      if (res.ok) {
        setHistorial(data.pedidos || [])
      }
    } catch {
      // ignore
    }
  }

  const cobrarPedido = async () => {
    if (!pedidoSeleccionado) return
    setProcesando(true)
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoSeleccionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'pagado',
          metodo_pago: metodo,
          propina: propinaMonto,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`✅ Pedido cobrado: ${currencyDetailed(total)}`)
        await loadPedidos()
        await loadHistorial()
        setPedidoSeleccionado(null)
        setPersonas(1)
      } else {
        toast.error(data.error || 'Error al cobrar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setProcesando(false)
    }
  }

  const anularCobro = async (pedidoId: string) => {
    if (!confirm('¿Anular este cobro? Se devolverá el inventario y se liberará la mesa.')) return
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'cancelado',
        }),
      })
      if (res.ok) {
        toast.success('Cobro anulado')
        await loadPedidos()
        await loadHistorial()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al anular')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const reimprimirTicket = async (pedido: any) => {
    toast.info(`🖨️ Reimprimiendo ticket de ${pedido.mesa_nombre || 'mesa'}`, {
      duration: 3000,
    })
    // Aquí iría la lógica de impresión real
  }

  const items = pedidoSeleccionado?.items || []
  const { subtotal, impuestos, propinaMonto, total, porPersona } = useMemo(() => {
    const subtotal = items.reduce((s: number, i: any) => s + i.precio_unitario * i.cantidad, 0)
    const impuestos = subtotal * IVA
    const base = subtotal + impuestos
    const propinaMonto = base * (propina / 100)
    const total = base + propinaMonto
    return { 
      subtotal, 
      impuestos, 
      propinaMonto, 
      total,
      porPersona: total / (personas > 0 ? personas : 1)
    }
  }, [items, propina, personas])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs: Cobros pendientes / Historial */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={!mostrarHistorial ? 'default' : 'outline'}
          onClick={() => setMostrarHistorial(false)}
        >
          Cobrar ({pedidos.length})
        </Button>
        <Button
          variant={mostrarHistorial ? 'default' : 'outline'}
          onClick={() => setMostrarHistorial(true)}
        >
          Historial ({historial.length})
        </Button>
      </div>

      {!mostrarHistorial ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Selección de pedido */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Pedidos listos para cobrar</h2>
              <Badge variant="outline" className="text-sm">
                {pedidos.length} pendientes
              </Badge>
            </div>

            {pedidos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="size-12 mx-auto text-status-free mb-4" />
                  <p className="text-muted-foreground font-medium">No hay pedidos listos</p>
                  <p className="text-sm text-muted-foreground">Espera a que la cocina prepare los pedidos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pedidos.map((p) => (
                  <Button
                    key={p.id}
                    variant={pedidoSeleccionado?.id === p.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPedidoSeleccionado(p)}
                    className="gap-2"
                  >
                    {p.mesa_nombre || `Mesa #${p.mesa_id}`}
                    <Badge variant="secondary" className="text-[10px]">
                      ${p.total?.toFixed(0) || 0}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}

            {pedidoSeleccionado && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="size-4 text-primary" />
                    Cuenta · {pedidoSeleccionado.mesa_nombre || `Mesa #${pedidoSeleccionado.mesa_id}`}
                  </CardTitle>
                  <CardDescription>
                    {items.length} ítems · Mesero: {pedidoSeleccionado.mesero_nombre || '—'}
                    <Badge variant="secondary" className="ml-2 text-xs">✅ Listo</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cant.</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">P. unit.</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {item.cantidad}
                          </TableCell>
                          <TableCell className="font-medium">{item.nombre_producto}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {currencyDetailed(item.precio_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {currencyDetailed(item.precio_unitario * item.cantidad)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel de pago */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Pago</CardTitle>
                <CardDescription>Selecciona propina y método de pago</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Propina */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Propina</p>
                  <ToggleGroup
                    value={[String(propina)]}
                    onValueChange={(v) => v[0] && setPropina(Number(v[0]))}
                    variant="outline"
                    className="w-full"
                  >
                    {propinaOpciones.map((p) => (
                      <ToggleGroupItem key={p} value={String(p)} className="flex-1">
                        {p === 0 ? 'Sin' : `${p}%`}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                {/* Dividir cuenta */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Users className="size-4" />
                    Dividir cuenta
                  </p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setPersonas(Math.max(1, personas - 1))}>-</Button>
                    <span className="font-medium tabular-nums w-8 text-center">{personas}</span>
                    <Button variant="outline" size="sm" onClick={() => setPersonas(personas + 1)}>+</Button>
                    {personas > 1 && (
                      <span className="text-sm text-muted-foreground ml-2">
                        = {currencyDetailed(porPersona)} c/u
                      </span>
                    )}
                  </div>
                </div>

                {/* Totales */}
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-4 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{currencyDetailed(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA (16%)</span>
                    <span className="tabular-nums">{currencyDetailed(impuestos)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Propina ({propina}%)</span>
                    <span className="tabular-nums">{currencyDetailed(propinaMonto)}</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex items-center justify-between font-display text-lg font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums text-primary">{currencyDetailed(total)}</span>
                  </div>
                  {personas > 1 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Por persona</span>
                      <span className="tabular-nums font-medium">{currencyDetailed(porPersona)}</span>
                    </div>
                  )}
                </div>

                {/* Método de pago */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Método de pago</p>
                  <div className="grid grid-cols-3 gap-2">
                    {metodos.map((m) => {
                      const Icon = m.icon
                      const active = metodo === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMetodo(m.id)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors',
                            active
                              ? 'border-primary bg-primary/12 text-primary'
                              : 'border-border text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <Icon className="size-5" />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  disabled={!pedidoSeleccionado || procesando}
                  onClick={cobrarPedido}
                >
                  {procesando && <Loader2 className="size-4 animate-spin mr-2" />}
                  Cobrar {currencyDetailed(total)}
                </Button>

                {pedidoSeleccionado && (
                  <p className="text-xs text-center text-muted-foreground">
                    Al cobrar, la mesa se liberará automáticamente
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Historial de cobros */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de cobros</CardTitle>
            <CardDescription>Últimos 20 pedidos cobrados</CardDescription>
          </CardHeader>
          <CardContent>
            {historial.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay cobros registrados</p>
            ) : (
              <div className="space-y-3">
                {historial.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.mesa_nombre || `Mesa #${p.mesa_id}`}</span>
                        <Badge variant="secondary">{p.metodo_pago || 'Efectivo'}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.fecha_creacion).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.items?.length || 0} ítems · Mesero: {p.mesero_nombre || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg font-semibold text-primary">
                        {currencyDetailed(p.total || 0)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reimprimirTicket(p)}
                        title="Reimprimir ticket"
                      >
                        <Printer className="size-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => anularCobro(p.id)}
                        title="Anular cobro"
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}