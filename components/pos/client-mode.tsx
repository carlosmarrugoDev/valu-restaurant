'use client'

import { useState, useEffect } from 'react'
import { QrCode, ShoppingCart, Search, Package, Loader2, X, Plus, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { currencyDetailed } from '@/lib/data'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ClientMode() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<any[]>([])
  const [mesaId, setMesaId] = useState<string | null>(null)

  useEffect(() => {
    // Intentar obtener la mesa de la URL o sessionStorage
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const mesaFromUrl = params.get('mesa')
      if (mesaFromUrl) {
        setMesaId(mesaFromUrl)
        sessionStorage.setItem('mesa_cliente', mesaFromUrl)
      } else {
        const storedMesa = sessionStorage.getItem('mesa_cliente')
        if (storedMesa) {
          setMesaId(storedMesa)
        }
      }
    }
    loadData()
  }, [])

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

  const enviarPedido = async () => {
    if (!mesaId) {
      toast.error('No se detectó la mesa')
      return
    }
    if (cart.length === 0) {
      toast.error('Agrega productos')
      return
    }

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
        }),
      })
      if (res.ok) {
        toast.success('✅ Pedido enviado a cocina')
        setCart([])
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al enviar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const filtered = productos.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    if (categoria && p.categoria_id !== categoria) return false
    return p.disponible
  })

  const totalCart = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header con mesa */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">🍽️ Menú</h1>
          {mesaId ? (
            <p className="text-sm text-muted-foreground">Mesa: <span className="font-medium text-primary">{mesaId}</span></p>
          ) : (
            <p className="text-sm text-destructive">⚠️ No se detectó la mesa. Escanea el QR.</p>
          )}
        </div>
        <Badge variant="outline" className="text-sm">
          {productos.length} platillos
        </Badge>
      </div>

      {/* Búsqueda y filtros */}
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

      {/* Grid de productos */}
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
                {p.stock === 0 && (
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
                    disabled={!mesaId || p.stock === 0}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Carrito flotante */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-card border border-border rounded-xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{cart.reduce((s, i) => s + i.cantidad, 0)} artículos</p>
              <p className="text-sm text-muted-foreground">{currencyDetailed(totalCart)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCart([])}>Vaciar</Button>
              <Button onClick={enviarPedido} disabled={!mesaId}>Pedir</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
            {cart.map((i) => (
              <Badge key={i.id} variant="secondary" className="flex items-center gap-1 text-xs">
                {i.nombre} x{i.cantidad}
                <button onClick={() => updateCantidad(i.id, -1)} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}