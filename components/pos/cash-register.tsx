'use client'

import { useState, useEffect } from 'react'
import { Wallet, Clock, Banknote, CreditCard, Smartphone, AlertCircle, Loader2, History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/components/auth/auth-context'
import { currencyDetailed } from '@/lib/data'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function CashRegister() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cierres, setCierres] = useState<any[]>([])
  const [cajaAbiertaId, setCajaAbiertaId] = useState<string | null>(null)
  const [ventasPorMetodo, setVentasPorMetodo] = useState<Record<string, number>>({})
  const [openDialog, setOpenDialog] = useState(false)
  const [openCierreDialog, setOpenCierreDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    saldo_inicial: '',
    turno: 'Mañana',
  })
  const [cierreForm, setCierreForm] = useState({
    efectivo: '',
    tarjeta: '',
    digital: '',
    notas: '',
  })

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/caja')
      const data = await res.json()
      if (res.ok) {
        setCierres(data.cierres || [])
        setCajaAbiertaId(data.caja_abierta_id || null)
        setVentasPorMetodo(data.ventas_por_metodo || {})
      } else {
        setError(data.error || 'Error al cargar datos de caja')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleAbrirCaja = async () => {
    if (!form.saldo_inicial || parseFloat(form.saldo_inicial) <= 0) {
      toast.error('Ingresa un saldo inicial válido')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saldo_inicial: parseFloat(form.saldo_inicial),
          turno: form.turno,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Caja abierta con $${form.saldo_inicial} de saldo inicial`)
        setOpenDialog(false)
        setForm({ saldo_inicial: '', turno: 'Mañana' })
        await loadData()
      } else {
        toast.error(data.error || 'Error al abrir caja')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleCerrarCaja = async () => {
    if (!cajaAbiertaId) return
    
    const efectivo = parseFloat(cierreForm.efectivo) || 0
    const tarjeta = parseFloat(cierreForm.tarjeta) || 0
    const digital = parseFloat(cierreForm.digital) || 0
    
    if (efectivo === 0 && tarjeta === 0 && digital === 0) {
      toast.error('Registra al menos un método de pago')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/caja', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cajaAbiertaId,
          efectivo,
          tarjeta,
          digital,
          notas: cierreForm.notas,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Caja cerrada correctamente')
        setOpenCierreDialog(false)
        setCierreForm({ efectivo: '', tarjeta: '', digital: '', notas: '' })
        await loadData()
      } else {
        toast.error(data.error || 'Error al cerrar caja')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const cajaActiva = cierres.find(c => c.id === cajaAbiertaId)

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
            <Wallet className="size-6 text-primary" />
            Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            Control de apertura y cierre de caja por turno
          </p>
        </div>
        {!cajaAbiertaId ? (
          <Button onClick={() => setOpenDialog(true)} className="gap-2">
            <Wallet className="size-4" />
            Abrir caja
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setOpenCierreDialog(true)} className="gap-2">
            Cerrar caja
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estado de caja actual */}
      {cajaActiva ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-green-500 animate-pulse" />
              Caja abierta
              <Badge variant="outline" className="ml-2 border-green-500/50 text-green-500">
                Turno {cajaActiva.turno}
              </Badge>
            </CardTitle>
            <CardDescription>
              Abierta el {new Date(cajaActiva.hora_apertura).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">Saldo inicial</p>
                <p className="font-display text-xl font-semibold">{currencyDetailed(cajaActiva.saldo_inicial)}</p>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="size-3" /> Efectivo</p>
                <p className="font-display text-xl font-semibold text-status-occupied">{currencyDetailed(ventasPorMetodo?.efectivo || 0)}</p>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="size-3" /> Tarjeta</p>
                <p className="font-display text-xl font-semibold text-status-bill">{currencyDetailed(ventasPorMetodo?.tarjeta || 0)}</p>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Smartphone className="size-3" /> Digital</p>
                <p className="font-display text-xl font-semibold text-status-free">{currencyDetailed(ventasPorMetodo?.digital || 0)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span>Total esperado: <strong className="text-foreground">{currencyDetailed(
                (cajaActiva.saldo_inicial || 0) + 
                (ventasPorMetodo?.efectivo || 0) + 
                (ventasPorMetodo?.tarjeta || 0) + 
                (ventasPorMetodo?.digital || 0)
              )}</strong></span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="size-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No hay caja abierta</p>
            <p className="text-sm text-muted-foreground">Abre la caja para comenzar el turno</p>
          </CardContent>
        </Card>
      )}

      {/* Historial de cierres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            Historial de cierres
          </CardTitle>
          <CardDescription>Últimos cierres de caja registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {cierres.filter(c => !c.abierto).length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No hay cierres registrados
            </p>
          ) : (
            <div className="space-y-3">
              {cierres.filter(c => !c.abierto).slice(0, 10).map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.turno}</span>
                      <Badge variant="secondary">Cerrado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.fecha).toLocaleDateString()} · 
                      {c.hora_apertura && ` Apertura: ${new Date(c.hora_apertura).toLocaleTimeString()}`}
                      {c.hora_cierre && ` · Cierre: ${new Date(c.hora_cierre).toLocaleTimeString()}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{currencyDetailed(c.total_contado || 0)}</p>
                    <p className={cn(
                      'text-xs tabular-nums',
                      c.diferencia !== undefined && Math.abs(c.diferencia) > 10 ? 'text-destructive' : 'text-status-free'
                    )}>
                      {c.diferencia !== undefined && (c.diferencia > 0 ? '+' : '')}{currencyDetailed(c.diferencia || 0)}
                      {c.diferencia !== undefined && Math.abs(c.diferencia) <= 10 && ' ✓'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogo Abrir Caja */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>Registra el saldo inicial y turno</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Saldo inicial *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.saldo_inicial}
                onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Monto en efectivo con el que inicia la caja</p>
            </div>
            <div>
              <Label>Turno</Label>
              <select
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
                value={form.turno}
                onChange={(e) => setForm({ ...form, turno: e.target.value })}
              >
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Noche">Noche</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleAbrirCaja} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Abrir caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo Cerrar Caja */}
      <Dialog open={openCierreDialog} onOpenChange={setOpenCierreDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDescription>Registra el conteo final por método de pago</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Banknote className="size-3" /> Efectivo</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={cierreForm.efectivo}
                  onChange={(e) => setCierreForm({ ...cierreForm, efectivo: e.target.value })}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1"><CreditCard className="size-3" /> Tarjeta</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={cierreForm.tarjeta}
                  onChange={(e) => setCierreForm({ ...cierreForm, tarjeta: e.target.value })}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Smartphone className="size-3" /> Digital</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={cierreForm.digital}
                  onChange={(e) => setCierreForm({ ...cierreForm, digital: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Observaciones del cierre"
                value={cierreForm.notas}
                onChange={(e) => setCierreForm({ ...cierreForm, notas: e.target.value })}
              />
            </div>
            {cajaActiva && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Saldo inicial</span>
                  <span>{currencyDetailed(cajaActiva.saldo_inicial)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ventas en efectivo</span>
                  <span>{currencyDetailed(ventasPorMetodo?.efectivo || 0)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-medium">
                  <span>Total esperado en caja</span>
                  <span>{currencyDetailed((cajaActiva.saldo_inicial || 0) + (ventasPorMetodo?.efectivo || 0))}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCierreDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCerrarCaja} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Cerrar caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}