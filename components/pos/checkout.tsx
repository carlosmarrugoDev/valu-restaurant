// components/pos/checkout.tsx - VERSIÓN CONECTADA
'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Banknote, CreditCard, Smartphone,
  Printer, Send, Users, Split, Receipt, Loader2,
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
import { useAuth } from '@/components/auth/auth-context'

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
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [split, setSplit] = useState('none')
  const [personas, setPersonas] = useState(2)
  const [propina, setPropina] = useState(15)
  const [metodo, setMetodo] = useState('tarjeta')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    loadPedidos()
  }, [user])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pedidos?activos=true')
      const data = await res.json()
      if (res.ok) {
        setPedidos(data.pedidos || [])
        if (data.pedidos?.length > 0 && (!pedidoSeleccionado || !data.pedidos.find((p: any) => p.id === pedidoSeleccionado.id))) {
          setPedidoSeleccionado(data.pedidos[0])
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
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
      if (res.ok) {
        await loadPedidos()
        setPedidoSeleccionado(null)
      }
    } catch {
      // ignore
    } finally {
      setProcesando(false)
    }
  }

  const items = pedidoSeleccionado?.items || []
  const { subtotal, impuestos, propinaMonto, total } = useMemo(() => {
    const subtotal = items.reduce((s: number, i: any) => s + i.precio_unitario * i.cantidad, 0)
    const impuestos = subtotal * IVA
    const base = subtotal + impuestos
    const propinaMonto = base * (propina / 100)
    return { subtotal, impuestos, propinaMonto, total: base + propinaMonto }
  }, [items, propina])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* Selección de pedido */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {pedidos.map((p) => (
            <Button
              key={p.id}
              variant={pedidoSeleccionado?.id === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPedidoSeleccionado(p)}
            >
              Mesa {p.mesa_nombre || p.mesa_id} · #{p.codigo_reclamo || p.numero_pedido}
            </Button>
          ))}
          {pedidos.length === 0 && (
            <p className="text-muted-foreground">No hay pedidos para cobrar</p>
          )}
        </div>

        {pedidoSeleccionado && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                Cuenta · {pedidoSeleccionado.mesa_nombre || `Mesa #${pedidoSeleccionado.mesa_id}`}
              </CardTitle>
              <CardDescription>
                {items.length} ítems · Mesero: {pedidoSeleccionado.mesero_nombre || '—'}
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
            <CardDescription>Selecciona propina y método</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
            </div>

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

            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                disabled={!pedidoSeleccionado || procesando}
                onClick={cobrarPedido}
              >
                {procesando && <Loader2 className="size-4 animate-spin mr-2" />}
                Cobrar {currencyDetailed(total)}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">
                  <Printer data-icon="inline-start" />
                  Imprimir
                </Button>
                <Button variant="outline">
                  <Send data-icon="inline-start" />
                  Enviar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}