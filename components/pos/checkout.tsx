'use client'

import { useMemo, useState } from 'react'
import {
  Banknote,
  CreditCard,
  Smartphone,
  Printer,
  Send,
  Users,
  Split,
  Receipt,
} from 'lucide-react'

import { cuentaActual, currencyDetailed } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const IVA = 0.16
const propinaOpciones = [0, 10, 15, 20]

const metodos = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'digital', label: 'Digital', icon: Smartphone },
]

export function Checkout() {
  const [split, setSplit] = useState('none')
  const [personas, setPersonas] = useState(2)
  const [propina, setPropina] = useState(15)
  const [metodo, setMetodo] = useState('tarjeta')

  const { subtotal, impuestos, propinaMonto, total } = useMemo(() => {
    const subtotal = cuentaActual.reduce((s, i) => s + i.precio * i.cantidad, 0)
    const impuestos = subtotal * IVA
    const base = subtotal + impuestos
    const propinaMonto = base * (propina / 100)
    return { subtotal, impuestos, propinaMonto, total: base + propinaMonto }
  }, [propina])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* Resumen de la cuenta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" /> Cuenta · Mesa 9
          </CardTitle>
          <CardDescription>5 ítems · Mesero: Lucía R. · Abierta 22 min</CardDescription>
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
              {cuentaActual.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {item.cantidad}
                  </TableCell>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {currencyDetailed(item.precio)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {currencyDetailed(item.precio * item.cantidad)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Dividir cuenta</p>
            <ToggleGroup
              value={[split]}
              onValueChange={(v) => v[0] && setSplit(v[0])}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="none" className="flex-1">
                Sin dividir
              </ToggleGroupItem>
              <ToggleGroupItem value="persona" className="flex-1">
                <Users data-icon="inline-start" />
                Por persona
              </ToggleGroupItem>
              <ToggleGroupItem value="item" className="flex-1">
                <Split data-icon="inline-start" />
                Por ítem
              </ToggleGroupItem>
            </ToggleGroup>

            {split === 'persona' && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Personas</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPersonas((n) => Math.max(2, n - 1))}
                    >
                      −
                    </Button>
                    <span className="w-7 text-center font-medium tabular-nums">{personas}</span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPersonas((n) => Math.min(12, n + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Por persona</p>
                  <p className="font-display font-semibold text-primary tabular-nums">
                    {currencyDetailed(total / personas)}
                  </p>
                </div>
              </div>
            )}

            {split === 'item' && (
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                Selecciona en cada ítem a qué comensal se asigna. Cada cuenta se cobra por
                separado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
              <Button size="lg" className="w-full">
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
