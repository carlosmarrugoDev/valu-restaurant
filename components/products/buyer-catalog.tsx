'use client'

import { useState, useEffect } from 'react'
import {
  ShoppingCart,
  Search,
  Tag,
  Star,
  Package,
  ShoppingBag,
  Loader2,
  Heart,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { currency } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-context'

interface Categoria {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  categoria_id?: string
  categoria_nombre?: string
  imagen_url?: string
  stock: number
  disponible: boolean
}

interface CartItem extends Producto {
  cantidad: number
}

export function BuyerCatalog() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [orden, setOrden] = useState<string>('recientes')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [soloFavoritos, setSoloFavoritos] = useState(false)
  const [soloDisponibles, setSoloDisponibles] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/productos?all=true'),
        fetch('/api/categorias?all=true'),
      ])
      const prodData = await prodRes.json()
      const catData = await catRes.json()
      setProductos(prodData.productos || [])
      setCategorias(catData.categorias || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  let filtered = productos.filter((p) => {
    if (soloDisponibles && !p.disponible) return false
    if (soloFavoritos && !favoritos.has(p.id)) return false
    if (filtroCategoria !== 'all' && p.categoria_id !== filtroCategoria) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.nombre.toLowerCase().includes(q) && !p.descripcion?.toLowerCase().includes(q)) return false
    }
    return true
  })

  switch (orden) {
    case 'precio-asc':
      filtered = [...filtered].sort((a, b) => a.precio - b.precio)
      break
    case 'precio-desc':
      filtered = [...filtered].sort((a, b) => b.precio - a.precio)
      break
    case 'nombre':
      filtered = [...filtered].sort((a, b) => a.nombre.localeCompare(b.nombre))
      break
  }

  const addToCart = (p: Producto) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id)
      if (existing) {
        return prev.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
      }
      return [...prev, { ...p, cantidad: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id))
  }

  const updateCantidad = (id: string, cantidad: number) => {
    if (cantidad <= 0) {
      removeFromCart(id)
      return
    }
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, cantidad } : i)))
  }

  const toggleFavorito = (id: string) => {
    setFavoritos((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const cartTotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0)

  const categoryCounts = categorias.map((c) => ({
    ...c,
    count: productos.filter((p) => p.categoria_id === c.id && p.disponible).length,
  }))

  return (
    <div className="flex flex-col gap-6 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/90 via-orange-600/80 to-primary p-6 md:p-10 -mt-2">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-20 -right-20 size-80 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-2xl">
          <Badge variant="secondary" className="bg-white/20 text-white border-0 backdrop-blur-sm mb-3">
            <ShoppingBag className="size-3 mr-1" />
            Modo Comprador
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">
            ¡Hola{user?.nombre ? `, ${user.nombre}` : ''}!
          </h1>
          <p className="mt-2 text-white/85 text-base md:text-lg">
            Explora nuestro catálogo de {productos.filter((p) => p.disponible).length} productos
            {categoryCounts.length > 0 && (
              <> en {categoryCounts.filter((c) => c.count > 0).length} categorías</>
            )}
            .
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-72 max-w-96">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar platillos, bebidas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <Select value={orden} onValueChange={(val) => setOrden(val ?? 'recientes')}>
          <SelectTrigger className="w-44 h-11">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recientes">Más recientes</SelectItem>
            <SelectItem value="precio-asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="precio-desc">Precio: mayor a menor</SelectItem>
            <SelectItem value="nombre">A - Z</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={soloFavoritos ? 'default' : 'outline'}
          onClick={() => setSoloFavoritos(!soloFavoritos)}
          className={cn('h-11 gap-2', soloFavoritos && 'bg-rose-500 hover:bg-rose-600')}
        >
          <Heart className={cn('size-4', soloFavoritos && 'fill-current')} />
          Favoritos ({favoritos.size})
        </Button>
        <Button
          variant={soloDisponibles ? 'default' : 'outline'}
          onClick={() => setSoloDisponibles(!soloDisponibles)}
          className="h-11 gap-2"
        >
          <Filter className="size-4" />
          {soloDisponibles ? 'Solo disponibles' : 'Ver todos'}
        </Button>
        <div className="ml-auto">
          <Button
            size="lg"
            onClick={() => setCartOpen(true)}
            className="relative h-11 gap-2"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 size-5 rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center shadow-md">
                {cartCount}
              </span>
            )}
            <span className="font-semibold">{currency(cartTotal)}</span>
          </Button>
        </div>
      </div>

      {/* Chips categorías */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filtroCategoria === 'all' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setFiltroCategoria('all')}
          className="rounded-full"
        >
          Todo ({productos.filter((p) => p.disponible).length})
        </Button>
        {categoryCounts
          .filter((c) => c.count > 0)
          .map((c) => (
            <Button
              key={c.id}
              variant={filtroCategoria === c.id ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFiltroCategoria(c.id)}
              className="rounded-full gap-1.5"
            >
              <Tag className="size-3" />
              {c.nombre} ({c.count})
            </Button>
          ))}
      </div>

      {/* Grid productos */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl border-border/60">
          <Package className="size-16 mx-auto mb-4 opacity-30" />
          <h3 className="font-display text-xl font-semibold">No se encontraron productos</h3>
          <p className="text-muted-foreground mt-2">
            Intenta cambiar los filtros de búsqueda
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="group overflow-hidden border-border/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-card/60"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-muted to-muted/60">
                {p.imagen_url ? (
                  <img
                    src={p.imagen_url}
                    alt={p.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div className={cn('w-full h-full items-center justify-center flex-col gap-2', p.imagen_url ? 'hidden absolute inset-0' : 'flex')}>
                  <Package className="size-12 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground/60">Sin imagen</p>
                </div>

                <button
                  onClick={() => toggleFavorito(p.id)}
                  className="absolute top-3 right-3 size-9 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                >
                  <Heart
                    className={cn(
                      'size-4 transition-colors',
                      favoritos.has(p.id)
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-muted-foreground',
                    )}
                  />
                </button>

                {p.categoria_nombre && (
                  <Badge variant="secondary" className="absolute top-3 left-3 backdrop-blur-md bg-background/80 text-xs">
                    {p.categoria_nombre}
                  </Badge>
                )}

                {p.stock === 0 && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Badge variant="destructive" className="text-sm px-4 py-1.5">
                      Agotado
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4 flex flex-col gap-3">
                <div className="space-y-1 min-h-[72px]">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-base leading-tight line-clamp-2">
                      {p.nombre}
                    </h3>
                    <span className="font-bold text-lg text-primary tabular-nums shrink-0">
                      {currency(p.precio)}
                    </span>
                  </div>
                  {p.descripcion && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {p.descripcion}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="size-3 fill-primary text-primary" />
                    <span>4.8</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>Stock: {p.stock}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addToCart(p)}
                    disabled={p.stock === 0}
                    className="gap-1.5"
                  >
                    <ShoppingCart className="size-4" />
                    Añadir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-xl">
              <ShoppingCart className="size-5" />
              Tu pedido ({cartCount})
            </SheetTitle>
            <SheetDescription>
              Revisa los artículos antes de confirmar
            </SheetDescription>
          </SheetHeader>
          <Separator />
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
              <ShoppingCart className="size-20 text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-lg">Tu carrito está vacío</p>
              <p className="text-muted-foreground text-sm mt-1">
                Añade productos desde el catálogo
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 py-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                      {item.imagen_url ? (
                        <img
                          src={item.imagen_url}
                          alt={item.nombre}
                          className="size-20 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="size-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="size-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-tight line-clamp-2">{item.nombre}</p>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {currency(item.precio)} c/u
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-7"
                              onClick={() => updateCantidad(item.id, item.cantidad - 1)}
                            >
                              −
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums">
                              {item.cantidad}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-7"
                              onClick={() => updateCantidad(item.id, item.cantidad + 1)}
                            >
                              +
                            </Button>
                          </div>
                          <p className="font-bold tabular-nums text-primary">
                            {currency(item.precio * item.cantidad)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="space-y-4 pt-4 border-t mt-2">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({cartCount} artículos)</span>
                    <span className="tabular-nums">{currency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Impuestos</span>
                    <span className="tabular-nums">{currency(cartTotal * 0.16)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary tabular-nums">{currency(cartTotal * 1.16)}</span>
                  </div>
                </div>
                <SheetFooter>
                  <Button size="lg" className="w-full text-base h-12">
                    Confirmar pedido
                  </Button>
                </SheetFooter>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
