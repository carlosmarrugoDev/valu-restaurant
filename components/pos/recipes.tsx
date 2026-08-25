'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Loader2, Package, Search, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'

interface RecetaItem {
  insumo_id: string
  cantidad: number
}

interface RecetaForm {
  producto_id: string
  cantidad_producida: number
  items: RecetaItem[]
}

export function Recipes() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<any[]>([])
  const [insumos, setInsumos] = useState<any[]>([])
  const [recetas, setRecetas] = useState<any[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<RecetaForm>({
    producto_id: '',
    cantidad_producida: 1,
    items: [],
  })
  const [newItem, setNewItem] = useState({ insumo_id: '', cantidad: 1 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodRes, insumosRes, recetasRes] = await Promise.all([
        fetch('/api/productos?all=true'),
        fetch('/api/inventario'),
        fetch('/api/recetas'),
      ])
      const prodData = await prodRes.json()
      const insumosData = await insumosRes.json()
      const recetasData = await recetasRes.json()
      setProductos(prodData.productos || [])
      setInsumos(insumosData.insumos || [])
      setRecetas(recetasData.recetas || [])
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ producto_id: '', cantidad_producida: 1, items: [] })
    setNewItem({ insumo_id: '', cantidad: 1 })
    setOpenDialog(true)
  }

  const openEdit = (receta: any) => {
    setEditing(receta)
    setForm({
      producto_id: receta.producto_id || '',
      cantidad_producida: receta.cantidad_producida || 1,
      items: receta.receta_items?.map((ri: any) => ({
        insumo_id: ri.insumo_id || '',
        cantidad: ri.cantidad || 0,
      })) || [],
    })
    setNewItem({ insumo_id: '', cantidad: 1 })
    setOpenDialog(true)
  }

  const addItem = () => {
    if (!newItem.insumo_id || newItem.cantidad <= 0) {
      toast.error('Selecciona un insumo y una cantidad válida')
      return
    }
    if (form.items.some(i => i.insumo_id === newItem.insumo_id)) {
      toast.error('Este insumo ya está en la receta')
      return
    }
    setForm({
      ...form,
      items: [...form.items, { insumo_id: newItem.insumo_id, cantidad: newItem.cantidad }],
    })
    setNewItem({ insumo_id: '', cantidad: 1 })
  }

  const removeItem = (index: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    })
  }

  const handleSave = async () => {
    if (!form.producto_id) {
      toast.error('Selecciona un producto')
      return
    }
    if (form.items.length === 0) {
      toast.error('Agrega al menos un insumo')
      return
    }

    setSaving(true)
    try {
      const url = editing ? `/api/recetas?id=${editing.id}` : '/api/recetas'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: form.producto_id,
          cantidad_producida: form.cantidad_producida,
          items: form.items,
        }),
      })

      if (res.ok) {
        toast.success(editing ? 'Receta actualizada' : 'Receta creada')
        setOpenDialog(false)
        await loadData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta receta?')) return
    try {
      const res = await fetch(`/api/recetas?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Receta eliminada')
        await loadData()
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const filtered = recetas.filter((r) => {
    const nombreProducto = r.productos?.nombre || r.producto_nombre || ''
    return nombreProducto.toLowerCase().includes(search.toLowerCase())
  })

  const productoSeleccionado = productos.find(p => p.id === form.producto_id)
  const insumoSeleccionado = insumos.find(i => i.id === newItem.insumo_id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-primary" />
            Recetas
          </h1>
          <p className="text-sm text-muted-foreground">
            {recetas.length} recetas registradas
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Nueva receta
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar receta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((receta) => {
          const nombreProducto = receta.productos?.nombre || receta.producto_nombre || 'Producto desconocido'
          const items = receta.receta_items || receta.items || []
          return (
            <Card key={receta.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{nombreProducto}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(receta)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(receta.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Rinde {receta.cantidad_producida || 1} porción(es)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {items.map((item: any, i: number) => {
                    const nombreInsumo = item.insumos?.nombre || item.insumo_nombre || 'Insumo'
                    const unidad = item.insumos?.unidad || item.unidad || ''
                    return (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{nombreInsumo}</span>
                        <span className="font-medium">{item.cantidad} {unidad}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Package className="size-12 mx-auto mb-4 opacity-30" />
            <p>No hay recetas registradas</p>
            <p className="text-sm">Crea una receta para vincular productos con insumos</p>
          </div>
        )}
      </div>

      {/* Dialog Crear/Editar Receta */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar receta' : 'Nueva receta'}</DialogTitle>
            <DialogDescription>
              Vincula un producto con los insumos que necesita
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Producto */}
            <div>
              <Label>Producto *</Label>
              <Select
                value={form.producto_id || ''}
                onValueChange={(v) => v && setForm({ ...form, producto_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} (${p.precio})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad producida - Deshabilitado por falta de columna en DB */}
            <div className="hidden">
              <Label>Cantidad que rinde</Label>
              <Input
                type="number"
                min="1"
                value={form.cantidad_producida}
                onChange={(e) => setForm({ ...form, cantidad_producida: Number(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Ej: 1 = una porción, 4 = 4 porciones</p>
            </div>

            <div className="border-t border-border pt-4">
              <Label className="mb-2 block">Insumos de la receta</Label>

              {/* Agregar insumo */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <Select
                    value={newItem.insumo_id || ''}
                    onValueChange={(v) => v && setNewItem({ ...newItem, insumo_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Insumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nombre} (stock: {i.stock} {i.unidad})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Cant."
                  className="w-24"
                  value={newItem.cantidad}
                  onChange={(e) => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
                />
                <Button type="button" variant="outline" onClick={addItem}>+</Button>
              </div>

              {/* Lista de insumos */}
              {form.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Agrega insumos a la receta
                </p>
              ) : (
                <div className="space-y-1">
                  {form.items.map((item, index) => {
                    const insumo = insumos.find(i => i.id === item.insumo_id)
                    return (
                      <div key={index} className="flex items-center justify-between bg-muted/30 p-2 rounded">
                        <span className="text-sm">
                          {insumo?.nombre || 'Insumo'} - {item.cantidad} {insumo?.unidad || ''}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => removeItem(index)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {productoSeleccionado && form.items.length > 0 && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="text-sm font-medium">Costo calculado:</p>
                <p className="text-lg font-bold text-primary">
                  $
                  {form.items.reduce((sum, item) => {
                    const insumo = insumos.find(i => i.id === item.insumo_id)
                    return sum + (insumo?.costo_unitario || 0) * item.cantidad
                  }, 0).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Precio de venta: ${productoSeleccionado.precio?.toFixed(2) || 0}
                  {' · '}
                  Margen: {
                    (productoSeleccionado.precio - form.items.reduce((sum, item) => {
                      const insumo = insumos.find(i => i.id === item.insumo_id)
                      return sum + (insumo?.costo_unitario || 0) * item.cantidad
                    }, 0)).toFixed(2)
                  }
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              {editing ? 'Guardar cambios' : 'Crear receta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}