// components/pos/order-taking.tsx - VERSIÓN CONECTADA
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Minus, Trash2, Send, ShoppingBag, StickyNote, Loader2 } from 'lucide-react'

import { categorias, currencyDetailed } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/components/auth/auth-context'

const IVA = 0.16

export function OrderTaking() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [mesas, setMesas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState('entradas')
  const [cart, setCart] = useState<any[]>([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [categoriasList, setCategoriasList] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodRes, mesasRes, catRes] = await Promise.all([
        fetch('/api/productos'),
        fetch('/api/mesas'),
        fetch('/api/categorias'),
      ])
      const prodData = await prodRes.json()
      const mesasData = await mesasRes.json()
      const catData = await catRes.json()

      setProductos(prodData.productos || [])
      setMesas(mesasData.mesas || [])
      const cats = catData.categorias || []
      setCategoriasList(cats)
      if (cats.length > 0) {
        setCategoria(cats[0].id)
      }
    } catch {
      // fallback a data mock
      const { productos: mockProductos } = await import('@/lib/data')
      setProductos(mockProductos.map(p => ({ ...p, categoria_id: p.categoria })))
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (producto: any) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.producto_id === producto.id)
      if (existing) {
        return prev.map((l) =>
          l.producto_id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        )
      }
      return [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        nota: '',
      }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.producto_id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    )
  }

  const changeNote = (id: string, nota: string) => {
    setCart((prev) => prev.map((l) => (l.producto_id === id ? { ...l, nota } : l)))
  }

  const removeLine = (id: string) => {
    setCart((prev) => prev.filter((l) => l.producto_id !== id))
  }

  const enviarPedido = async () => {
    if (!mesaSeleccionada) {
      alert('Selecciona una mesa')
      return
    }
    if (cart.length === 0) {
      alert('Agrega productos al pedido')
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: mesaSeleccionada,
          items: cart.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio: item.precio,
            nota: item.nota,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCart([])
        setMesaSeleccionada(null)
        // Recargar mesas para actualizar estados
        await loadData()
      } else {
        alert(data.error || 'Error al enviar pedido')
      }
    } catch (error) {
      alert('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  const { subtotal, impuestos, total, totalItems } = useMemo(() => {
    const subtotal = cart.reduce((sum, l) => sum + l.precio * l.cantidad, 0)
    const impuestos = subtotal * IVA
    return {
      subtotal,
      impuestos,
      total: subtotal + impuestos,
      totalItems: cart.reduce((sum, l) => sum + l.cantidad, 0),
    }
  }, [cart])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* Menú */}
      <div>
        <div className="mb-4">
          <label className="text-sm font-medium">Mesa</label>
          <select
            className="ml-2 rounded-md border border-border bg-background p-2"
            value={mesaSeleccionada || ''}
            onChange={(e) => setMesaSeleccionada(e.target.value || null)}
          >
            <option value="">Seleccionar mesa...</option>
            {mesas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.estado})
              </option>
            ))}
          </select>
        </div>

        {(() => {
          const catItems = categoriasList.length > 0
            ? categoriasList.map(c => ({ id: c.id, label: c.nombre }))
            : categorias

          return (
            <Tabs value={categoria} onValueChange={setCategoria}>
              <TabsList className="w-full flex-wrap">
                {catItems.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>{c.label}</TabsTrigger>
                ))}
              </TabsList>

              {catItems.map((c) => (
                <TabsContent key={c.id} value={c.id} className="mt-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {productos
                      .filter((p) => p.categoria_id === c.id || p.categoria === c.id || (!p.categoria_id && c.id === 'entradas'))
                      .map((p) => (
                        <Card key={p.id} className="overflow-hidden pt-0">
                          <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                            {p.imagen_url ? (
                              <img
                                src={p.imagen_url}
                                alt={p.nombre}
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <ShoppingBag className="size-8 opacity-30" />
                              </div>
                            )}
                          </div>
                          <CardContent className="flex flex-1 flex-col gap-1 p-3">
                            <p className="text-sm font-medium leading-snug text-balance">
                              {p.nombre}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="font-display font-semibold text-primary">
                                {currencyDetailed(p.precio)}
                              </span>
                              <Button
                                size="icon-sm"
                                onClick={() => addToCart(p)}
                                disabled={!mesaSeleccionada}
                                aria-label={`Agregar ${p.nombre}`}
                              >
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
          )
        })()}
      </div>

      {/* Carrito */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card className="flex max-h-[calc(100dvh-8rem)] flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-primary" />
                <h2 className="font-display font-semibold">
                  Pedido {mesaSeleccionada ? `· ${mesas.find(m => m.id === mesaSeleccionada)?.nombre || ''}` : ''}
                </h2>
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
                  {mesaSeleccionada ? 'Selecciona platillos del menú' : 'Selecciona una mesa primero'}
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {cart.map((line) => (
                  <div key={line.producto_id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.nombre}</p>
                        <p className="text-xs text-muted-foreground">{currencyDetailed(line.precio)} c/u</p>
                      </div>
                      <span className="font-medium tabular-nums">
                        {currencyDetailed(line.precio * line.cantidad)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon-sm" variant="outline" onClick={() => changeQty(line.producto_id, -1)}>
                          <Minus />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums">
                          {line.cantidad}
                        </span>
                        <Button size="icon-sm" variant="outline" onClick={() => changeQty(line.producto_id, 1)}>
                          <Plus />
                        </Button>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.producto_id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="relative">
                      <StickyNote className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={line.nota}
                        onChange={(e) => changeNote(line.producto_id, e.target.value)}
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

            <Button
              size="lg"
              className="w-full"
              disabled={cart.length === 0 || !mesaSeleccionada || enviando}
              onClick={enviarPedido}
            >
              {enviando ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send data-icon="inline-start" />}
              Enviar a cocina
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}