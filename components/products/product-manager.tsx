'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  FileSpreadsheet,
  X,
  Package,
  Tag,
  Download,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/components/auth/auth-context'
import { cn, currency } from '@/lib/utils'

interface Categoria {
  id: string
  nombre: string
  descripcion?: string
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
  fecha_creacion: string
}

export function ProductManager() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [openDialog, setOpenDialog] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
    imagen_url: '',
    stock: '',
    disponible: true,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<{
    show: boolean
    loading: boolean
    creados?: number
    errores?: number
    message?: string
    progress?: number
  }>({ show: false, loading: false })

  useEffect(() => {
    loadData()
  }, [user])

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
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = productos.filter((p) => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.descripcion?.toLowerCase().includes(search.toLowerCase()))
    const matchCat = filtroCategoria === 'all' || p.categoria_id === filtroCategoria
    return matchSearch && matchCat
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      nombre: '',
      descripcion: '',
      precio: '',
      categoria_id: categorias[0]?.id || '',
      imagen_url: '',
      stock: '0',
      disponible: true,
    })
    setOpenDialog(true)
  }

  const openEdit = (p: Producto) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: String(p.precio),
      categoria_id: p.categoria_id || '',
      imagen_url: p.imagen_url || '',
      stock: String(p.stock),
      disponible: p.disponible,
    })
    setOpenDialog(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      alert('Ingresa el nombre del producto')
      return
    }

    if (editing) {
      const res = await fetch(`/api/productos?id=${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          precio: Number(form.precio) || 0,
          categoria_id: form.categoria_id || null,
          imagen_url: form.imagen_url,
          stock: Number(form.stock) || 0,
          disponible: form.disponible,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setProductos(productos.map((p) => (p.id === editing.id ? data.producto : p)))
      }
    } else {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          precio: Number(form.precio) || 0,
          categoria_id: form.categoria_id || null,
          imagen_url: form.imagen_url,
          stock: Number(form.stock) || 0,
          disponible: form.disponible,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setProductos([data.producto, ...productos])
      }
    }
    setOpenDialog(false)
    loadData()
  }

  const handleDelete = async (p: Producto) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    const res = await fetch(`/api/productos?id=${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setProductos(productos.filter((x) => x.id !== p.id))
    }
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus({ show: true, loading: true, progress: 20 })

    try {
      const formData = new FormData()
      formData.append('file', file)

      setImportStatus({ show: true, loading: true, progress: 50 })

      const res = await fetch('/api/productos/import-excel', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      setImportStatus({
        show: true,
        loading: false,
        progress: 100,
        creados: data.creados,
        errores: data.errores,
        message: res.ok
          ? `Importación completada: ${data.creados} productos creados, ${data.errores} errores. ${data.categoriasNuevas ? data.categoriasNuevas + ' categorías nuevas.' : ''}`
          : data.error || 'Error en la importación',
      })

      if (res.ok) {
        await loadData()
      }
    } catch (error: any) {
      setImportStatus({
        show: true,
        loading: false,
        progress: 100,
        message: 'Error: ' + error.message,
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const downloadTemplate = () => {
    const headers = ['nombre', 'precio', 'categoria', 'descripcion', 'stock', 'imagen']
    const sample = [
      ['Tacos al pastor', '165', 'Platos fuertes', 'Orden de 4 tacos con piña', '100', ''],
      ['Agua de horchata', '55', 'Bebidas', 'Jarra de arroz con canela', '50', ''],
      ['Flan napolitano', '95', 'Postres', 'Flan de la casa con caramelo', '30', ''],
    ]
    const csv = [headers, ...sample].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-productos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: productos.length,
    conStock: productos.filter((p) => p.stock > 0).length,
    sinStock: productos.filter((p) => p.stock === 0).length,
    valorTotal: productos.reduce((s, p) => s + (p.precio * p.stock), 0),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-primary" />
            Gestión de Productos
          </h1>
          <p className="text-sm text-muted-foreground">
            Administra tu inventario, categorías y sube productos desde Excel
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="size-4" />
            Plantilla CSV
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelUpload}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <FileSpreadsheet className="size-4" />
              Subir Excel
            </Button>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {importStatus.show && (
        <Alert>
          <FileSpreadsheet />
          <AlertTitle>{importStatus.loading ? 'Importando Excel...' : 'Resultado de importación'}</AlertTitle>
          <AlertDescription className="space-y-2">
            {importStatus.loading && <Progress value={importStatus.progress} />}
            <p>{importStatus.message}</p>
            {!importStatus.loading && (
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">Creados: {importStatus.creados ?? 0}</Badge>
                <Badge variant="destructive">Errores: {importStatus.errores ?? 0}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setImportStatus({ show: false, loading: false })}>
                  Cerrar
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total productos</p>
            <p className="text-2xl font-display font-semibold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Con inventario</p>
            <p className="text-2xl font-display font-semibold mt-1 text-green-500">{stats.conStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Agotados</p>
            <p className="text-2xl font-display font-semibold mt-1 text-destructive">{stats.sinStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor inventario</p>
            <p className="text-2xl font-display font-semibold mt-1">{currency(stats.valorTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Productos</CardTitle>
              <CardDescription>{filtered.length} resultados</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="size-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No hay productos</p>
              <p className="text-sm mt-1">
                {search || filtroCategoria !== 'all' ? 'Intenta con otra búsqueda' : 'Crea tu primer producto o sube un Excel'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="w-10 h-10 rounded-lg object-cover"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="size-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p>{p.nombre}</p>
                          {p.descripcion && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{p.descripcion}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.categoria_nombre ? (
                        <Badge variant="outline" className="gap-1">
                          <Tag className="size-3" />
                          {p.categoria_nombre}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin categoría</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{currency(p.precio)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={cn(p.stock === 0 && 'text-destructive')}>{p.stock}</span>
                    </TableCell>
                    <TableCell>
                      {p.disponible ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                          Disponible
                        </Badge>
                      ) : (
                        <Badge variant="outline">Oculto</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Editar">
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p)} aria-label="Eliminar" className="text-destructive hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del producto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej. Tacos al pastor"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={form.categoria_id || 'none'} onValueChange={(v) => setForm({ ...form, categoria_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.disponible ? 'si' : 'no'} onValueChange={(v) => setForm({ ...form, disponible: v === 'si' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Disponible</SelectItem>
                    <SelectItem value="no">Oculto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL de imagen (opcional)</Label>
              <Input
                placeholder="https://..."
                value={form.imagen_url}
                onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción breve del producto..."
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? 'Guardar cambios' : 'Crear producto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
