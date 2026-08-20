'use client'

import { useState } from 'react'
import {
  User,
  Phone,
  MapPin,
  CreditCard,
  Mail,
  Star,
  Edit3,
  Save,
  X,
  Sparkles,
  Heart,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth, User as UserType } from '@/components/auth/auth-context'
import { currency } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function UserProfile() {
  const { user, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<UserType>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const startEdit = () => {
    setForm({
      nombre: user?.nombre || '',
      telefono: user?.telefono || '',
      direccion: user?.direccion || '',
      metodo_pago: user?.metodo_pago || '',
    })
    setEditing(true)
    setMessage(null)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm({})
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const res = await updateProfile(form)
    if (res.success) {
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' })
      setEditing(false)
    } else {
      setMessage({ type: 'error', text: res.error || 'Error al actualizar' })
    }
    setSaving(false)
  }

  const completitudPerfil = () => {
    if (!user) return 0
    let fields = 0
    let filled = 0
    const checks: (keyof UserType)[] = ['nombre', 'email', 'telefono', 'direccion', 'metodo_pago']
    for (const f of checks) {
      fields++
      if (user[f]) filled++
    }
    return Math.round((filled / fields) * 100)
  }

  const emptyFields = () => {
    if (!user) return []
    const empty: string[] = []
    if (!user.telefono) empty.push('Teléfono')
    if (!user.direccion) empty.push('Dirección')
    if (!user.metodo_pago) empty.push('Método de pago')
    return empty
  }

  const completitud = completitudPerfil()
  const emptyList = emptyFields()
  const initials = user?.nombre
    ? user.nombre
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??'

  const rolLabel: Record<string, { label: string; color: string }> = {
    comprador: { label: 'Comprador', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    vendedor: { label: 'Vendedor', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    admin: { label: 'Administrador', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  }
  const rolInfo = rolLabel[user?.rol || 'comprador'] || rolLabel.comprador

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <User className="size-6 text-primary" />
            Mi Perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus datos personales y preferencias
          </p>
        </div>
        {!editing ? (
          <Button onClick={startEdit} className="gap-2">
            <Edit3 className="size-4" />
            Editar perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={cancelEdit} disabled={saving} className="gap-2">
              <X className="size-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="size-4" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          {message.type === 'success' ? <Sparkles /> : <AlertCircle />}
          <AlertTitle>{message.type === 'success' ? '¡Listo!' : 'Error'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tarjeta de presentación */}
        <Card className="lg:col-span-1 overflow-hidden relative">
          <div className="h-28 bg-gradient-to-br from-primary/80 via-orange-500/70 to-primary" />
          <CardContent className="-mt-10 pt-0 relative">
            <Avatar className="size-20 border-4 border-card shadow-lg">
              <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-xl font-semibold">
                    {editing ? (
                      <Input
                        value={form.nombre || ''}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        className="h-9"
                      />
                    ) : (
                      user.nombre || <span className="text-muted-foreground italic">Sin nombre</span>
                    )}
                  </h2>
                  <Badge variant="outline" className={cn(rolInfo.color)}>
                    {rolInfo.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Mail className="size-3.5" />
                  {user.email}
                </p>
              </div>

              <SeparatorInline />

              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium">Completitud del perfil</span>
                  <span className="text-muted-foreground tabular-nums">{completitud}%</span>
                </div>
                <Progress value={completitud} className="h-2" />
                {emptyList.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Falta: {emptyList.join(', ')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border border-border/60 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <Star className="size-4 fill-primary" />
                    <span className="text-xl font-display font-bold tabular-nums">
                      {user.puntos ?? 0}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Puntos</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3 text-center">
                  <div className="text-xl font-display font-bold tabular-nums text-primary">
                    {currency(Number(user.gasto_total ?? 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">Gasto total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Información personal</CardTitle>
            <CardDescription>
              Estos datos se usan para procesar tus pedidos y comunicaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              icon={Phone}
              label="Teléfono"
              value={user.telefono}
              editing={editing}
              editValue={form.telefono || ''}
              onEditChange={(v) => setForm({ ...form, telefono: v })}
              placeholder="+52 55 1234 5678"
            />
            <Field
              icon={MapPin}
              label="Dirección"
              value={user.direccion}
              editing={editing}
              editValue={form.direccion || ''}
              onEditChange={(v) => setForm({ ...form, direccion: v })}
              placeholder="Calle, número, colonia, ciudad"
            />
            <Field
              icon={CreditCard}
              label="Método de pago"
              value={user.metodo_pago}
              editing={editing}
              editValue={form.metodo_pago || ''}
              onEditChange={(v) => setForm({ ...form, metodo_pago: v })}
              placeholder="Visa •••• 4412, Efectivo, Transferencia..."
            />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="size-4 text-rose-500" />
                <Label>Preferencias</Label>
              </div>
              {user.preferencias && user.preferencias.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.preferencias.map((p, i) => (
                    <Badge key={i} variant="secondary">{p}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aún no has configurado preferencias (ej: sin cebolla, poco picante...)
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="size-4 text-destructive" />
                <Label>Alergias</Label>
              </div>
              {user.alergias && user.alergias.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.alergias.map((a, i) => (
                    <Badge key={i} variant="destructive">{a}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Sin alergias registradas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({
  icon: Icon,
  label,
  value,
  editing,
  editValue,
  onEditChange,
  placeholder,
  multiline,
}: {
  icon: any
  label: string
  value?: string
  editing: boolean
  editValue: string
  onEditChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Label>
      {editing ? (
        multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            placeholder={placeholder}
          />
        )
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 min-h-[40px] flex items-center">
          {value ? (
            <span className="text-sm">{value}</span>
          ) : (
            <span className="text-sm text-muted-foreground italic">No configurado</span>
          )}
        </div>
      )}
    </div>
  )
}

function SeparatorInline() {
  return <div className="h-px bg-border/60 -mx-2" />
}
