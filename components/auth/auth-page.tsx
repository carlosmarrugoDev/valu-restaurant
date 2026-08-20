'use client'

import { useState } from 'react'
import { useAuth } from './auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Store, Zap, Crown, Building2, Loader2, Flame, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'
type Plan = 'arranque' | 'profesional' | 'multi-sede'

const planes: { id: Plan; label: string; desc: string; icon: any; precio: string; features: string[]; popular?: boolean }[] = [
  {
    id: 'arranque',
    label: 'Arranque',
    desc: 'Ideal para negocios pequeños',
    icon: Zap,
    precio: '$499/mes',
    features: ['Hasta 8 mesas', '1 sede', 'Pedidos y cocina', 'Cobros básicos'],
  },
  {
    id: 'profesional',
    label: 'Profesional',
    desc: 'Para restaurantes en crecimiento',
    icon: Crown,
    precio: '$999/mes',
    features: ['Mesas ilimitadas', '1 sede', 'Inventario completo', 'Reportes avanzados', 'Dashboard analítico'],
    popular: true,
  },
  {
    id: 'multi-sede',
    label: 'Multi-Sede',
    desc: 'Controla todas tus sucursales',
    icon: Building2,
    precio: '$1,999/mes',
    features: ['Todo de Profesional', 'Sedes ilimitadas', 'Reportes consolidados', 'Gestión centralizada', 'API integrada'],
  },
]

export function AuthPage() {
  const { login, register, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre_dueño: '',
    telefono: '',
    direccion: '',
    nombre_restaurante: '',
    plan: 'profesional' as Plan,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === 'login') {
      const res = await login(form.email, form.password)
      if (!res.success) setError(res.error || 'Error')
    } else {
      if (!form.nombre_restaurante.trim()) {
        setError('Ingresa el nombre del restaurante')
        return
      }
      if (!form.nombre_dueño.trim()) {
        setError('Ingresa el nombre del dueño')
        return
      }
      if (form.password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres')
        return
      }
      const res = await register({
        email: form.email,
        password: form.password,
        nombre: form.nombre_dueño,
        nombre_restaurante: form.nombre_restaurante,
        plan: form.plan,
        rol: 'dueno',
        telefono: form.telefono || undefined,
        direccion: form.direccion || undefined,
      })
      if (!res.success) setError(res.error || 'Error')
      else setSuccess('¡Restaurante registrado correctamente!')
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#1a1512] via-[#2a1f1a] to-[#1a1512] p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 size-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-80 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-2xl relative z-10 bg-card/80 backdrop-blur-xl border-border/60 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Flame className="size-7" />
            </span>
          </div>
          <CardTitle className="font-display text-2xl">Valu Restaurant POS</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Inicia sesión en tu restaurante' : 'Registra tu nuevo restaurante'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <Label>Nombre del restaurante</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Mi Restaurante S.A."
                      value={form.nombre_restaurante}
                      onChange={(e) => setForm({ ...form, nombre_restaurante: e.target.value })}
                      disabled={loading}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Selecciona tu plan</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {planes.map((plan) => {
                      const Icon = plan.icon
                      const selected = form.plan === plan.id
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setForm({ ...form, plan: plan.id })}
                          disabled={loading}
                          className={cn(
                            'relative flex flex-col gap-2 p-4 rounded-xl border-2 transition-all text-left',
                            selected
                              ? 'border-primary bg-primary/10'
                              : 'border-border/60 hover:border-border bg-card',
                            plan.popular && !selected && 'border-primary/40',
                          )}
                        >
                          {plan.popular && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                              POPULAR
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              'flex size-8 items-center justify-center rounded-lg',
                              selected ? 'bg-primary text-primary-foreground' : 'bg-muted',
                            )}>
                              <Icon className="size-4" />
                            </span>
                            {selected && (
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-3" />
                              </span>
                            )}
                          </div>
                          <div>
                            <p className={cn('font-semibold text-sm', selected && 'text-primary')}>
                              {plan.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{plan.desc}</p>
                          </div>
                          <p className="font-display text-base font-bold">{plan.precio}</p>
                          <ul className="space-y-1">
                            {plan.features.slice(0, 3).map((f) => (
                              <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Check className="size-3" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_dueño">Nombre del dueño</Label>
                    <Input
                      id="nombre_dueño"
                      placeholder="Juan Pérez"
                      value={form.nombre_dueño}
                      onChange={(e) => setForm({ ...form, nombre_dueño: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      placeholder="+52 555 123 4567"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección del restaurante</Label>
                  <Input
                    id="direccion"
                    placeholder="Av. Principal 123, Col. Centro"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@restaurante.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 text-sm">
                {success}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {mode === 'login' ? 'Iniciar sesión' : 'Crear restaurante'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground text-center w-full">
            {mode === 'login' ? (
              <>
                ¿No tienes restaurante?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Regístralo gratis
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Inicia sesión
                </button>
              </>
            )}
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
