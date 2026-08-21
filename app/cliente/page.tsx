'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function ClientPageContent() {
  const searchParams = useSearchParams()
  const mesa = searchParams.get('mesa')
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [categoria, setCategoria] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<any[]>([])
  const [mesaId, setMesaId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (mesa) {
      setMesaId(mesa)
      sessionStorage.setItem('mesa_cliente', mesa)
    } else {
      const stored = sessionStorage.getItem('mesa_cliente')
      if (stored) setMesaId(stored)
    }
    loadData()
  }, [mesa])

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
      const cats = catData.categorias || []
      setCategorias(cats)
      if (cats.length > 0) {
        setCategoria(cats[0].id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (p: any) => {
    if (!mesaId) {
      alert('No se detectó la mesa. Escanea el QR nuevamente.')
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id)
      if (existing) {
        return prev.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, { ...p, cantidad: 1 }]
    })
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
      alert('No se detectó la mesa')
      return
    }
    if (cart.length === 0) {
      alert('Agrega productos')
      return
    }

    setEnviando(true)
    try {
      // Buscar la mesa por nombre
      const mesaNombre = mesaId.replace(/-/g, ' ')
      const res = await fetch('/api/mesas')
      const data = await res.json()
      const mesas = data.mesas || []
      const mesaEncontrada = mesas.find((m: any) => 
        m.nombre.toLowerCase() === mesaNombre.toLowerCase() ||
        m.nombre.toLowerCase().replace(/\s+/g, '-') === mesaId
      )

      if (!mesaEncontrada) {
        alert('Mesa no encontrada. Por favor, escanea el QR nuevamente.')
        setEnviando(false)
        return
      }

      const pedidoRes = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: mesaEncontrada.id,
          items: cart.map(item => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
        }),
      })
      
      if (pedidoRes.ok) {
        alert('✅ Pedido enviado a cocina')
        setCart([])
      } else {
        const errorData = await pedidoRes.json()
        alert('Error: ' + (errorData.error || 'No se pudo enviar el pedido'))
      }
    } catch (error) {
      alert('Error de conexión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const totalCart = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const filtered = productos.filter(p => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    if (categoria && p.categoria_id !== categoria) return false
    return p.disponible
  })

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">🍽️ Menú</h1>
            {mesaId ? (
              <p className="text-sm text-muted-foreground">
                Mesa: <span className="font-medium text-primary">{mesaId.replace(/-/g, ' ')}</span>
              </p>
            ) : (
              <p className="text-sm text-destructive">⚠️ No se detectó la mesa</p>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {productos.length} platillos
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Buscar platillos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 pl-10 rounded-lg border border-border bg-background text-foreground"
          />
          <span className="absolute left-3 top-3 text-muted-foreground">🔍</span>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categoria === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {/* Productos */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl border-border/60">
            <p className="text-muted-foreground">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="aspect-4/3 bg-muted flex items-center justify-center relative">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl opacity-20">🍽️</span>
                  )}
                  {p.stock === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-destructive text-white px-3 py-1 rounded-full text-xs font-bold">Agotado</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm line-clamp-2">{p.nombre}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-primary">
                      ${p.precio?.toFixed(2) || '0.00'}
                    </span>
                    <button
                      onClick={() => addToCart(p)}
                      disabled={!mesaId || p.stock === 0}
                      className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Carrito flotante */}
        {cart.length > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-card border border-border rounded-xl shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{cart.reduce((s, i) => s + i.cantidad, 0)} artículos</p>
                <p className="text-sm text-muted-foreground">${totalCart.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCart([])}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted"
                >
                  Vaciar
                </button>
                <button
                  onClick={enviarPedido}
                  disabled={enviando || !mesaId}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {enviando ? 'Enviando...' : 'Pedir'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
              {cart.map((i) => (
                <span key={i.id} className="bg-muted px-2 py-1 rounded-full text-xs flex items-center gap-1">
                  {i.nombre} x{i.cantidad}
                  <button
                    onClick={() => updateCantidad(i.id, -1)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    }>
      <ClientPageContent />
    </Suspense>
  )
}