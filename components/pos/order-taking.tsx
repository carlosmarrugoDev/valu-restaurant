'use client'

import { useMemo, useState } from 'react'
import { Plus, Minus, Trash2, Send, ShoppingBag, StickyNote } from 'lucide-react'

import {
  type Categoria,
  type Producto,
  categorias,
  currencyDetailed,
  productos,
} from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

type CartLine = {
  producto: Producto
  cantidad: number
  nota: string
}

const IVA = 0.16

export function OrderTaking() {
  const [cart, setCart] = useState<CartLine[]>([])
  const [categoria, setCategoria] = useState<Categoria>('entradas')

  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.producto.id === producto.id)
      if (existing) {
        return prev.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        )
      }
      return [...prev, { producto, cantidad: 1, nota: '' }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.producto.id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    )
  }

  const changeNote = (id: string, nota: string) => {
    setCart((prev) => prev.map((l) => (l.producto.id === id ? { ...l, nota } : l)))
  }

  const removeLine = (id: string) => {
    setCart((prev) => prev.filter((l) => l.producto.id !== id))
  }

  const { subtotal, impuestos, total, totalItems } = useMemo(() => {
    const subtotal = cart.reduce((sum, l) => sum + l.producto.precio * l.cantidad, 0)
    const impuestos = subtotal * IVA
    return {
      subtotal,
      impuestos,
      total: subtotal + impuestos,
      totalItems: cart.reduce((sum, l) => sum + l.cantidad, 0),
    }
  }, [cart])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* Menú */}
      <div>
        <Tabs value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
          <TabsList className="w-full flex-wrap">
            {categorias.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categorias.map((c) => (
            <TabsContent key={c.id} value={c.id} className="mt-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {productos
                  .filter((p) => p.categoria === c.id)
                  .map((p) => (
                    <Card key={p.id} className="overflow-hidden pt-0">
                      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imagen || '/placeholder.svg'}
                          alt={p.nombre}
                          className="size-full object-cover"
                        />
                      </div>
                      <CardContent className="flex flex-1 flex-col gap-1">
                        <p className="text-sm font-medium leading-snug text-balance">
                          {p.nombre}
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {p.descripcion}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="font-display font-semibold text-primary">
                            {currencyDetailed(p.precio)}
                          </span>
                          <Button size="icon-sm" onClick={() => addToCart(p)} aria-label={`Agregar ${p.nombre}`}>
                            <Plus />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Carrito / pedido actual */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card className="flex max-h-[calc(100dvh-8rem)] flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-primary" />
                <h2 className="font-display font-semibold">Pedido · Mesa 9</h2>
              </div>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                {totalItems} ítems
              </span>
            </div>

            <Separator />

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                <ShoppingBag className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Selecciona platillos del menú para armar el pedido.
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {cart.map((line) => (
                  <div key={line.producto.id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.producto.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {currencyDetailed(line.producto.precio)} c/u
                        </p>
                      </div>
                      <span className="font-medium tabular-nums">
                        {currencyDetailed(line.producto.precio * line.cantidad)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() => changeQty(line.producto.id, -1)}
                          aria-label="Quitar uno"
                        >
                          <Minus />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums">
                          {line.cantidad}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() => changeQty(line.producto.id, 1)}
                          aria-label="Agregar uno"
                        >
                          <Plus />
                        </Button>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.producto.id)}
                        aria-label="Eliminar del pedido"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="relative">
                      <StickyNote className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={line.nota}
                        onChange={(e) => changeNote(line.producto.id, e.target.value)}
                        placeholder="Modificador o nota…"
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{currencyDetailed(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (16%)</span>
                <span className="tabular-nums">{currencyDetailed(impuestos)}</span>
              </div>
              <div className="flex justify-between font-display text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-primary">{currencyDetailed(total)}</span>
              </div>
            </div>

            <Button size="lg" className="w-full" disabled={cart.length === 0}>
              <Send data-icon="inline-start" />
              Enviar a cocina
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
