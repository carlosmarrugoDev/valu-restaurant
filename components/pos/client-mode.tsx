'use client'

import { useState, useEffect } from 'react'
import {
  QrCode, ShoppingCart, Search, Package, Loader2, X, Plus, Minus,
  Banknote, CreditCard, Smartphone, CheckCircle2, Clock, ChefHat,
  Bell, Ticket, ArrowLeft
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { currencyDetailed } from '@/lib/data'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

const IVA = 0.16

const metodosPago = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'digital', label: 'Transferencia', icon: Smartphone },
]

type EstadoPedido = 'pendiente_pago' | 'en_cocina' | 'listo' | 'pagado' | 'cancelado'

interface PedidoActivo {
  id: string
  numero_pedido: number
  mesa_id: string | null
  estado: EstadoPedido
  items: any[]
  subtotal: number
  impuestos: number
  total: number
  metodo_pago?: string | null
  fecha_creacion: string
}

export function ClientMode() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<any[]>([])
  const [mesaId, setMesaId] = useState<string | null>(null)

  const [showPago, setShowPago] = useState(false)
  const [metodoSeleccionado, setMetodoSeleccionado] = useState('tarjeta')
  const [procesandoPago, setProcesandoPago] = useState(false)

  const [pedidoActivo, setPedidoActivo] = useState<PedidoActivo | null>(null)
  const [pollingPedidos, setPollingPedidos] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const mesaFromUrl = params.get('mesa')
      if (mesaFromUrl) {
        setMesaId(mesaFromUrl)
        sessionStorage.setItem('mesa_cliente', mesaFromUrl)
      } else {
        const storedMesa = sessionStorage.getItem('mesa_cliente')
        if (storedMesa) setMesaId(storedMesa)
      }
      const storedPedido = sessionStorage.getItem('pedido_activo')
      if (storedPedido) {
        try {
          setPedidoActivo(JSON.parse(storedPedido))
          setPollingPedidos(true)
        } catch {}
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!pedidoActivo || !pollingPedidos) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pedidos?activos=true&mesa_id=${pedidoActivo.mesa_id}`)
        const data = await res.json()
        const miPedido = data.pedidos?.find((p: any) => p.id === pedidoActivo.id)
        if (miPedido) {
          const actualizado = {
            ...pedidoActivo,
            estado: miPedido.estado as EstadoPedido,
            items: miPedido.items || pedidoActivo.items,
          }
          if (miPedido.estado === 'listo' && pedidoActivo.estado !== 'listo') {
            try {
              if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400])
            } catch {}
            toast.success('🔔 ¡Tu pedido está listo!', { duration: 8000 })
          }
          setPedidoActivo(actualizado)
          sessionStorage.setItem('pedido_activo', JSON.stringify(actualizado))
          if (['pagado', 'cancelado'].includes(miPedido.estado)) {
            setPollingPedidos(false)
          }
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [pedidoActivo?.id, pollingPedidos])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/productos'),
        fetch('/api/categorias'),
      ])
      const prodData = await prodRes.json()
      const catData = await catRes.json()
      setProductos(prodData.productos || [])
      setCategorias(catData.categorias || [])
      if (catData.categorias?.length > 0) {
        setCategoria(catData.categorias[0].id)
      }
    } catch {
      toast.error('Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (p: any) => {
    if (!mesaId) {
      toast.error('No se detectó la mesa. Escanea el QR nuevamente.')
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id)
      if (existing) {
        return prev.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, { ...p, cantidad: 1 }]
    })
    toast.success(`${p.nombre} agregado`)
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id))
  }

  const updateCantidad = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      const nueva = item.cantidad + delta
      if (nueva <= 0) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, cantidad: nueva } : i)
    })
  }

  const subtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const impuestos = subtotal * IVA
  const total = subtotal + impuestos

  const confirmarPedido = () => {
    if (cart.length === 0) return
    setShowPago(true)
  }

  const procesarPago = async () => {
    if (!mesaId || cart.length === 0) return
    setProcesandoPago(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: mesaId,
          items: cart.map(item => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
          es_qr: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear pedido')
      }
      const { pedido } = await res.json()

      const pagoRes = await fetch(`/api/pedidos?id=${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'pagado',
          metodo_pago: metodoSeleccionado,
          propina: 0,
        }),
      })
      if (!pagoRes.ok) {
        const err = await pagoRes.json()
        throw new Error(err.error || 'Error al procesar pago')
      }
      const pagoData = await pagoRes.json()

      const itemsRes = await fetch('/api/pedidos?activos=true')
      const itemsData = await itemsRes.json()
      const pedidoDetalle = itemsData.pedidos?.find((p: any) => p.id === pedido.id) || pagoData.pedido

      const activo: PedidoActivo = {
        id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        mesa_id: mesaId,
        estado: pagoData.pedido.estado,
        items: pedidoDetalle.items || cart.map((i: any) => ({
          nombre_producto: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio,
          subtotal: i.precio * i.cantidad,
        })),
        subtotal,
        impuestos,
        total,
        metodo_pago: metodoSeleccionado,
        fecha_creacion: pedido.fecha_creacion || new Date().toISOString(),
      }
      setPedidoActivo(activo)
      sessionStorage.setItem('pedido_activo', JSON.stringify(activo))
      setPollingPedidos(true)
      setCart([])
      setShowPago(false)
      toast.success('✅ Pedido confirmado. Cocina lo está preparando.')
    } catch (e: any) {
      toast.error(e.message || 'Error')
    } finally {
      setProcesandoPago(false)
    }
  }

  const cancelarPedidoActivo = async () => {
    if (!pedidoActivo) return
    if (!confirm('¿Cancelar tu pedido?')) return
    try {
      await fetch(`/api/pedidos?id=${pedidoActivo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado', motivo: 'Cancelado por cliente' }),
      })
      toast.info('Pedido cancelado')
    } catch {}
    setPedidoActivo(null)
    sessionStorage.removeItem('pedido_activo')
    setPollingPedidos(false)
  }

  const limpiarPedidoActivo = () => {
    if (!['en_cocina', 'listo', 'pendiente_pago'].includes(pedidoActivo?.estado || '')) {
      setPedidoActivo(null)
      sessionStorage.removeItem('pedido_activo')
      setPollingPedidos(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (pedidoActivo && ['en_cocina', 'listo', 'pendiente_pago'].includes(pedidoActivo.estado)) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="size-6 text-primary" />
            <div>
              <h1 className="font-display text-2xl font-bold">Tu Comprobante</h1>
              <p className="text-sm text-muted-foreground">
                Pedido <span className="font-semibold text-primary">P-{pedidoActivo.numero_pedido}</span>
              </p>
            </div>
          </div>
          <EstadoBadge estado={pedidoActivo.estado} />
        </div>

        <Card className={cn(
          'overflow-hidden border-2 transition-colors',
          pedidoActivo.estado === 'listo'
            ? 'border-green-500 bg-green-500/5'
            : pedidoActivo.estado === 'en_cocina'
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-border'
        )}>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(pedidoActivo.fecha_creacion).toLocaleString()}
              </span>
              {pedidoActivo.mesa_id && (
                <Badge variant="outline">Mesa {pedidoActivo.mesa_id}</Badge>
              )}
            </div>

            <div className="space-y-1.5">
              {pedidoActivo.items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums text-muted-foreground w-6">
                      {it.cantidad}×
                    </span>
                    {it.nombre_producto}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {currencyDetailed((it.precio_unitario ?? it.precio) * (it.cantidad ?? 1))}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{currencyDetailed(pedidoActivo.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (16%)</span>
                <span className="tabular-nums">{currencyDetailed(pedidoActivo.impuestos)}</span>
              </div>
              <div className="flex justify-between font-display text-lg font-semibold pt-1">
                <span>Total</span>
                <span className="tabular-nums text-primary">
                  {currencyDetailed(pedidoActivo.total)}
                </span>
              </div>
              {pedidoActivo.metodo_pago && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Método de pago</span>
                  <span className="capitalize font-medium">{pedidoActivo.metodo_pago}</span>
                </div>
              )}
            </div>

            <div className={cn(
              'flex items-center gap-3 p-4 rounded-xl text-sm',
              pedidoActivo.estado === 'listo'
                ? 'bg-green-500/10 text-green-700'
                : pedidoActivo.estado === 'en_cocina'
                  ? 'bg-amber-500/10 text-amber-700'
                  : 'bg-muted text-muted-foreground'
            )}>
              <StatusIcon estado={pedidoActivo.estado} />
              <div className="flex-1">
                <p className="font-medium">{StatusLabel(pedidoActivo.estado)}</p>
                <p className="text-xs opacity-80">
                  {pedidoActivo.estado === 'listo'
                    ? 'Muestra este comprobante para reclamar tu pedido'
                    : pedidoActivo.estado === 'en_cocina'
                      ? 'Cocina está preparando tu pedido. Te avisaremos cuando esté listo.'
                      : 'Confirmando pago...'}
                </p>
              </div>
              {pedidoActivo.estado === 'listo' && (
                <Bell className="size-5 animate-bounce" />
              )}
            </div>

            {pedidoActivo.estado !== 'listo' && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-destructive"
                onClick={cancelarPedidoActivo}
              >
                Cancelar pedido
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={limpiarPedidoActivo} className="text-xs text-muted-foreground">
            <ArrowLeft className="size-3 mr-1" />
            Cerrar y volver al menú
          </Button>
        </div>
      </div>
    )
  }

  const filtered = productos.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    if (categoria && p.categoria_id !== categoria) return false
    return p.disponible
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">🍽️ Menú</h1>
          {mesaId ? (
            <p className="text-sm text-muted-foreground">
              Mesa: <span className="font-medium text-primary">{mesaId}</span>
            </p>
          ) : (
            <p className="text-sm text-destructive">⚠️ No se detectó la mesa. Escanea el QR.</p>
          )}
        </div>
        <Badge variant="outline" className="text-sm">
          {productos.length} platillos
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar platillos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map((c) => (
            <Button
              key={c.id}
              variant={categoria === c.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoria(c.id)}
            >
              {c.nombre}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl border-border/60">
          <Package className="size-16 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">No hay productos disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden pt-0">
              <div className="aspect-4/3 bg-muted flex items-center justify-center relative">
                {p.imagen_url ? (
                  <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                ) : (
                  <Package className="size-12 text-muted-foreground/30" />
                )}
                {(!p.disponible || p.stock_calculado === 0) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Badge variant="destructive">Agotado</Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm line-clamp-2">{p.nombre}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary">{currencyDetailed(p.precio)}</span>
                  <Button
                    size="sm"
                    onClick={() => addToCart(p)}
                    disabled={!mesaId || !p.disponible || p.stock_calculado === 0}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-card border border-border rounded-xl shadow-2xl z-40">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{cart.reduce((s, i) => s + i.cantidad, 0)} artículos</p>
              <p className="text-sm text-muted-foreground">
                {currencyDetailed(subtotal)} <span className="text-[11px] opacity-70">+ IVA</span>
                {' → '}
                <span className="font-semibold text-primary">{currencyDetailed(total)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCart([])}>Vaciar</Button>
              <Button onClick={confirmarPedido} disabled={!mesaId}>
                Pedir y pagar
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
            {cart.map((i) => (
              <Badge key={i.id} variant="secondary" className="flex items-center gap-1 text-xs">
                {i.nombre} x{i.cantidad}
                <button
                  onClick={() => updateCantidad(i.id, -1)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="quitar uno"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showPago} onOpenChange={setShowPago}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pago</DialogTitle>
            <DialogDescription>
              Este es un pago simulado. Elige un método y confirma para enviar tu pedido a cocina.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5 text-sm bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{currencyDetailed(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (16%)</span>
                <span className="tabular-nums">{currencyDetailed(impuestos)}</span>
              </div>
              <Separator className="my-1.5" />
              <div className="flex justify-between font-display text-lg font-semibold">
                <span>Total a pagar</span>
                <span className="tabular-nums text-primary">{currencyDetailed(total)}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {metodosPago.map((m) => {
                  const Icon = m.icon
                  const active = metodoSeleccionado === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoSeleccionado(m.id)}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPago(false)} disabled={procesandoPago}>
              Cancelar
            </Button>
            <Button onClick={procesarPago} disabled={procesandoPago}>
              {procesandoPago && <Loader2 className="size-4 mr-2 animate-spin" />}
              Pagar {currencyDetailed(total)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  const map: Record<EstadoPedido, { label: string; variant: any }> = {
    pendiente_pago: { label: 'Pago pendiente', variant: 'secondary' },
    en_cocina: { label: 'En preparación', variant: 'default' },
    listo: { label: '¡Listo!', variant: 'default' },
    pagado: { label: 'Pagado', variant: 'secondary' },
    cancelado: { label: 'Cancelado', variant: 'destructive' },
  }
  const cfg = map[estado]
  return (
    <Badge variant={cfg.variant} className={cn(
      estado === 'listo' && 'bg-green-600 hover:bg-green-600 text-white',
      estado === 'en_cocina' && 'bg-amber-600 hover:bg-amber-600 text-white',
    )}>
      {cfg.label}
    </Badge>
  )
}

function StatusIcon({ estado }: { estado: EstadoPedido }) {
  switch (estado) {
    case 'listo':
      return <CheckCircle2 className="size-6 shrink-0" />
    case 'en_cocina':
      return <ChefHat className="size-6 shrink-0 animate-pulse" />
    default:
      return <Clock className="size-6 shrink-0" />
  }
}

function StatusLabel(estado: EstadoPedido): string {
  switch (estado) {
    case 'listo': return 'Tu pedido está listo para reclamar'
    case 'en_cocina': return 'En cocina — lo estamos preparando'
    case 'pendiente_pago': return 'Confirmando tu pago'
    default: return 'Procesando'
  }
}
