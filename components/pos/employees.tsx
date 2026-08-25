'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Edit2, Trash2, UserPlus, Mail, Phone, Shield, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'
import { Rol, PERMISOS_POR_ROL } from '@/lib/permissions'

const ROLES: { id: Rol; label: string }[] = [
  { id: 'dueno', label: 'Dueño' },
  { id: 'gerente', label: 'Gerente' },
  { id: 'mesero', label: 'Mesero' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'cajero', label: 'Cajero' },
]

export function Employees() {
  const { user } = useAuth()
  const [empleados, setEmpleados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    rol: 'mesero' as Rol,
    password: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadEmpleados()
  }, [user])

  const loadEmpleados = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/empleados')
      const data = await res.json()
      if (res.ok) {
        setEmpleados(data.empleados || [])
      }
    } catch {
      toast.error('Error al cargar empleados')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.email.trim()) {
      toast.error('Nombre y email son requeridos')
      return
    }

    setSaving(true)
    try {
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/empleados?id=${editing.id}` : '/api/empleados'
      
      const body: any = {
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        rol: form.rol,
      }
      
      if (!editing && form.password) {
        body.password = form.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editing ? 'Empleado actualizado' : 'Empleado creado')
        setOpenDialog(false)
        setForm({ nombre: '', email: '', telefono: '', rol: 'mesero', password: '' })
        await loadEmpleados()
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
    if (!confirm('¿Eliminar este empleado?')) return
    try {
      const res = await fetch(`/api/empleados?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Empleado eliminado')
        await loadEmpleados()
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const rolColor = (rol: string) => {
    const colors: Record<string, string> = {
      dueno: 'bg-purple-500/20 text-purple-500',
      gerente: 'bg-blue-500/20 text-blue-500',
      mesero: 'bg-green-500/20 text-green-500',
      cocina: 'bg-orange-500/20 text-orange-500',
      cajero: 'bg-yellow-500/20 text-yellow-500',
    }
    return colors[rol] || 'bg-gray-500/20 text-gray-500'
  }

  const permisos = form.rol ? PERMISOS_POR_ROL[form.rol] || [] : []

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
            <Users className="size-6 text-primary" />
            Personal
          </h1>
          <p className="text-sm text-muted-foreground">
            {empleados.length} empleados registrados
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ nombre: '', email: '', telefono: '', rol: 'mesero', password: '' }); setOpenDialog(true) }}>
          <UserPlus className="size-4 mr-2" />
          Nuevo empleado
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de empleados</CardTitle>
          <CardDescription>Gestiona los accesos y roles del personal</CardDescription>
        </CardHeader>
        <CardContent>
          {empleados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="size-12 mx-auto mb-3 opacity-40" />
              <p>No hay empleados registrados</p>
              <p className="text-sm">Agrega a tu personal para empezar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.nombre}</TableCell>
                    <TableCell>{emp.email}</TableCell>
                    <TableCell>{emp.telefono || '—'}</TableCell>
                    <TableCell>
                      <Badge className={rolColor(emp.rol)}>
                        {ROLES.find(r => r.id === emp.rol)?.label || emp.rol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.activo ? 'secondary' : 'outline'}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(emp)
                            setForm({
                              nombre: emp.nombre,
                              email: emp.email,
                              telefono: emp.telefono || '',
                              rol: emp.rol,
                              password: '',
                            })
                            setOpenDialog(true)
                          }}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(emp.id)}
                          className="text-destructive hover:text-destructive"
                        >
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

      {/* Dialog Crear/Editar */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Actualiza los datos del empleado' : 'Registra a un nuevo miembro del equipo'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  placeholder="Nombre completo"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="correo@restaurante.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+52 55 1234 5678"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rol *</Label>
                <Select value={form.rol} onValueChange={(v) => v && setForm({ ...form, rol: v as Rol })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Contraseña *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 4 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                Permisos del rol
              </Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/30 border border-border">
                {permisos.length > 0 ? (
                  permisos.slice(0, 6).map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {p.replace('_', ' ')}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Sin permisos definidos</span>
                )}
                {permisos.length > 6 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{permisos.length - 6} más
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              {editing ? 'Guardar cambios' : 'Crear empleado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}