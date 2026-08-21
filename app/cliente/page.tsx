'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Clock, CheckCircle, XCircle, Package, ShoppingCart, ArrowLeft } from 'lucide-react'

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
  const [mesaNombre, setMesaNombre] = useState<string>('')
  const [enviando, setEnviando] = useState(false)
  
  // Estado del pedido del cliente
  const [pedidoActivo, setPedidoActivo] = useState<any | null>(null)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState<number>(0)
  const [verEstadoPedido, setVerEstadoPedido] = useState(false)
  const [cargandoPedido, setCargandoPedido] = useState(false)

  useEffect(() => {
    if (mesa) {
      setMesaId(mesa)
      setMesaNombre(mesa.replace(/-/g, ' '))
      sessionStorage.setItem('mesa_cliente', mesa)
    } else {
      const stored = sessionStorage.getItem('mesa_cliente')
      if (stored) {
        setMesaId(stored)
        setMesaNombre(stored.replace(/-/g, ' '))
      }
    }
    loadData()
  }, [mesa])

  // Polling para verificar estado del pedido activo
  useEffect(() => {
    if (mesaId) {
      verificarPedidoActivo()
      const interval = setInterval(verificarPedidoActivo, 5000)
      return () => clearInterval(interval)
    }
  }, [mesaId])

  // Timer para tiempo transcurrido
  useEffect(() => {
    if (pedidoActivo) {
      const timer = setInterval(() => {
        if (pedidoActivo.fecha_creacion) {
          const segundos = Math.floor((Date.now() - new Date(pedidoActivo.fecha_creacion).getTime()) / 1000)
          setTiempoTranscurrido(segundos)
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [pedidoActivo])

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

  const verificarPedidoActivo = async () => {
    if (!mesaId) return
    setCargandoPedido(true)
    try {
      // Buscar la mesa por nombre
      const mesasRes = await fetch('/api/mesas')
      const mesasData = await mesasRes.json()
      const mesas = mesasData.mesas || []
      const mesaEncontrada = mesas.find((m: any) => 
        m.nombre.toLowerCase() === mesaNombre.toLowerCase() ||
        m.nombre.toLowerCase().replace(/\s+/g, '-') === mesaId
      )

      if (!mesaEncontrada) {
        setCargandoPedido(false)
        return
      }

      // Buscar pedidos activos de esta mesa
      const pedidosRes = await fetch(`/api/pedidos?mesa_id=${mesaEncontrada.id}&activos=true`)
      const pedidosData = await pedidosRes.json()
      const pedidos = pedidosData.pedidos || []
      
      // Filtrar pedidos que no estén pagados o cancelados
      const activos = pedidos.filter((p: any) => 
        p.estado !== 'pagado' && p.estado !== 'cancelado'
      )

      if (activos.length > 0) {
        const pedido = activos[0] // Tomar el más reciente
        setPedidoActivo(pedido)
        const segundos = Math.floor((Date.now() - new Date(pedido.fecha_creacion).getTime()) / 1000)
        setTiempoTranscurrido(segundos)
        setVerEstadoPedido(true)
      } else {
        // Si no hay pedidos activos, mostrar el menú
        setPedidoActivo(null)
        setVerEstadoPedido(false)
        setTiempoTranscurrido(0)
      }
    } catch (error) {
      console.error('Error verificando pedido:', error)
    } finally {
      setCargandoPedido(false)
    }
  }

  const addToCart = (p: any) => {
    if (!mesaId) {
      alert('No se detectó la mesa. Escanea el QR nuevamente.')
      return
    }
    if (pedidoActivo) {
      alert('Ya tienes un pedido activo. Espera a que sea atendido antes de hacer otro.')
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
      const mesasRes = await fetch('/api/mesas')
      const mesasData = await mesasRes.json()
      const mesas = mesasData.mesas || []
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
        const data = await pedidoRes.json()
        alert('✅ Pedido enviado a cocina')
        setCart([])
        // Recargar el pedido activo
        await verificarPedidoActivo()
        setVerEstadoPedido(true)
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

  const volverAlMenu = () => {
    setVerEstadoPedido(false)
    setPedidoActivo(null)
    setTiempoTranscurrido(0)
  }

  const totalCart = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)

  // Formatear tiempo
  const formatTiempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60)
    const secs = segundos % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  const getEstadoLabel = (estado: string) => {
    const map: Record<string, { label: string; color: string; icon: any }> = {
      'en_cocina': { label: '⏳ En preparación', color: 'text-yellow-500', icon: Clock },
      'listo': { label: '✅ Listo para servir', color: 'text-green-500', icon: CheckCircle },
      'pagado': { label: '✅ Entregado y pagado', color: 'text-green-600', icon: CheckCircle },
      'cancelado': { label: '❌ Cancelado', color: 'text-red-500', icon: XCircle },
    }
    return map[estado] || { label: estado, color: 'text-muted-foreground', icon: Package }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // Si hay un pedido activo y queremos ver su estado
  if (verEstadoPedido && pedidoActivo) {
    const estadoInfo = getEstadoLabel(pedidoActivo.estado)
    const EstadoIcon = estadoInfo.icon
    const items = pedidoActivo.items || []
    const totalPedido = items.reduce((s: number, i: any) => s + i.precio_unitario * i.cantidad, 0)

    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Botón volver */}
          <button
            onClick={volverAlMenu}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="size-4" />
            Volver al menú
          </button>

          {/* Estado del pedido */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Mi pedido</h2>
              <span className={`font-semibold ${estadoInfo.color}`}>
                <EstadoIcon className="inline size-5 mr-1" />
                {estadoInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>📍 {mesaNombre}</span>
              <span>🕐 {formatTiempo(tiempoTranscurrido)}</span>
              <span>📋 {items.length} items</span>
            </div>

            {/* Items del pedido */}
            <div className="space-y-2 mb-4">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50">
                  <div>
                    <span className="font-medium">{item.cantidad}×</span>
                    <span className="ml-2">{item.nombre_producto}</span>
                  </div>
                  <span className="text-sm font-medium">${(item.precio_unitario * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-border font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${totalPedido.toFixed(2)}</span>
            </div>

            {/* Progreso */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Pedido recibido</span>
                <span>En preparación</span>
                <span>Listo para servir</span>
                <span>Entregado</span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-primary rounded-full transition-all duration-500"
                  style={{ 
                    width: pedidoActivo.estado === 'en_cocina' ? '33%' :
                           pedidoActivo.estado === 'listo' ? '66%' :
                           pedidoActivo.estado === 'pagado' ? '100%' : '0%'
                  }}
                />
              </div>
            </div>

            {/* Mensaje según estado */}
            <div className="mt-4 text-sm">
              {pedidoActivo.estado === 'en_cocina' && (
                <p className="text-yellow-600">🍳 Tu pedido está siendo preparado. Tiempo estimado: 5-10 minutos.</p>
              )}
              {pedidoActivo.estado === 'listo' && (
                <p className="text-green-600">🛎️ ¡Tu pedido está listo! El mesero lo llevará a tu mesa.</p>
              )}
              {pedidoActivo.estado === 'pagado' && (
                <p className="text-green-600">✅ Pedido entregado y pagado. ¡Gracias por tu visita!</p>
              )}
            </div>
          </div>

          {/* Sugerencias */}
          {pedidoActivo.estado === 'pagado' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">¿Quieres pedir algo más?</p>
              <button
                onClick={volverAlMenu}
                className="mt-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
              >
                Volver al menú
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Menú normal (sin pedido activo)
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
                Mesa: <span className="font-medium text-primary">{mesaNombre}</span>
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
                      disabled={!mesaId || p.stock === 0 || !!pedidoActivo}
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
        {cart.length > 0 && !pedidoActivo && (
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

        {/* Indicador de pedido activo */}
        {pedidoActivo && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-card border border-primary/30 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-primary">🔄 Tienes un pedido en curso</p>
                <p className="text-sm text-muted-foreground">
                  {getEstadoLabel(pedidoActivo.estado).label} · {formatTiempo(tiempoTranscurrido)}
                </p>
              </div>
              <button
                onClick={() => setVerEstadoPedido(true)}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
              >
                Ver estado
              </button>
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