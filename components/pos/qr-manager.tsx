'use client'

import { useState, useEffect, useRef } from 'react'
import { QrCode, Download, Printer, Copy, Check, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/components/auth/auth-context'
import { toast } from 'sonner'

const QR_API_URL = 'https://api.qrserver.com/v1/create-qr-code/'

export function QRManager() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [mesas, setMesas] = useState<any[]>([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('')
  const [qrUrl, setQrUrl] = useState<string>('')
  const [copiado, setCopiado] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMesas()
    // Usar el dominio real configurado
    setBaseUrl('https://valu-restaurant.vercel.app')
  }, [user])

  const loadMesas = async () => {
    try {
      const res = await fetch('/api/mesas')
      const data = await res.json()
      if (res.ok) {
        setMesas(data.mesas || [])
        if (data.mesas?.length > 0) {
          setMesaSeleccionada(data.mesas[0].id)
        }
      }
    } catch {
      toast.error('Error al cargar mesas')
    }
  }

  const generarQR = () => {
    if (!mesaSeleccionada) {
      toast.error('Selecciona una mesa')
      return
    }

    setLoading(true)
    const mesa = mesas.find(m => m.id === mesaSeleccionada)
    if (!mesa) {
      toast.error('Mesa no encontrada')
      setLoading(false)
      return
    }

    const clientUrl = `${baseUrl}/cliente?mesa=${mesa.nombre.toLowerCase().replace(/\s+/g, '-')}`
    const qrGenerated = `${QR_API_URL}?size=300x300&data=${encodeURIComponent(clientUrl)}&format=png&bgcolor=ffffff&color=1a1512`
    
    setQrUrl(qrGenerated)
    setLoading(false)
    toast.success('QR generado para ' + mesa.nombre)
  }

  const copiarURL = () => {
    if (!mesaSeleccionada) return
    const mesa = mesas.find(m => m.id === mesaSeleccionada)
    if (!mesa) return
    
    const clientUrl = `${baseUrl}/cliente?mesa=${mesa.nombre.toLowerCase().replace(/\s+/g, '-')}`
    navigator.clipboard.writeText(clientUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
    toast.success('URL copiada al portapapeles')
  }

  const descargarQR = () => {
    if (!qrUrl) return
    const link = document.createElement('a')
    const mesa = mesas.find(m => m.id === mesaSeleccionada)
    link.download = `qr-mesa-${mesa?.nombre || 'restaurante'}.png`
    link.href = qrUrl
    link.target = '_blank'
    link.click()
    toast.success('Descargando QR...')
  }

  const imprimirQR = () => {
    if (!qrRef.current) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Permite ventanas emergentes para imprimir')
      return
    }
    
    const mesa = mesas.find(m => m.id === mesaSeleccionada)
    const clientUrl = `${baseUrl}/cliente?mesa=${mesa?.nombre.toLowerCase().replace(/\s+/g, '-') || ''}`
    
    printWindow.document.write(`
      <html>
        <head>
          <title>QR - ${mesa?.nombre || 'Restaurante'}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fff; }
            .qr-container { text-align: center; padding: 40px; border: 2px dashed #ccc; border-radius: 16px; }
            .qr-image { width: 300px; height: 300px; margin: 20px auto; }
            .title { font-size: 24px; font-weight: bold; color: #1a1512; }
            .subtitle { font-size: 16px; color: #666; margin-top: 8px; }
            .footer { margin-top: 24px; font-size: 14px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
            .mesa-label { display: inline-block; background: #1a1512; color: white; padding: 8px 24px; border-radius: 8px; font-size: 18px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="title">Escanea para pedir</div>
            <div class="mesa-label">${mesa?.nombre || 'Mesa'}</div>
            <img src="${qrUrl}" class="qr-image" alt="QR Code" />
            <div class="subtitle">${clientUrl}</div>
            <div class="footer">${new Date().toLocaleDateString()} · ${baseUrl}</div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const mesaActual = mesas.find(m => m.id === mesaSeleccionada)
  
  const handleMesaChange = (value: string | null) => {
    if (value) setMesaSeleccionada(value)
  }
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <QrCode className="size-6 text-primary" />
            Códigos QR para mesas
          </h1>
          <p className="text-sm text-muted-foreground">
            Genera códigos QR para que los clientes pidan desde su celular
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurar QR</CardTitle>
            <CardDescription>
              Selecciona una mesa y genera su código QR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Seleccionar mesa</Label>
              <Select value={mesaSeleccionada} onValueChange={handleMesaChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una mesa" />
                </SelectTrigger>
                <SelectContent>
                  {mesas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre} ({m.estado})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={generarQR} disabled={loading || !mesaSeleccionada} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                Generar QR
              </Button>
              {qrUrl && (
                <>
                  <Button variant="outline" onClick={copiarURL} className="gap-2">
                    {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copiado ? 'Copiado' : 'Copiar URL'}
                  </Button>
                  <Button variant="outline" onClick={descargarQR} className="gap-2">
                    <Download className="size-4" />
                    Descargar
                  </Button>
                  <Button variant="outline" onClick={imprimirQR} className="gap-2">
                    <Printer className="size-4" />
                    Imprimir
                  </Button>
                </>
              )}
            </div>

            {qrUrl && mesaActual && (
              <div className="rounded-lg bg-muted/30 p-3 text-xs">
                <p className="font-medium text-muted-foreground">URL del menú:</p>
                <code className="block mt-1 break-all text-primary">
                  {baseUrl}/cliente?mesa={mesaActual.nombre.toLowerCase().replace(/\s+/g, '-')}
                </code>
                <p className="mt-2 text-muted-foreground">
                  Los clientes escanearán este QR y verán el menú para pedir
                </p>
              </div>
            )}

            {mesas.length === 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3">
                <AlertCircle className="size-5 text-destructive" />
                <div>
                  <p className="font-medium text-sm">No hay mesas creadas</p>
                  <p className="text-xs text-muted-foreground">
                    Ve a "Mesas" y crea algunas mesas primero
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Vista previa
              {mesaActual && (
                <Badge variant="secondary" className="ml-2">
                  {mesaActual.nombre}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {qrUrl ? 'Código QR generado para la mesa' : 'Genera un QR para ver la vista previa'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center min-h-[320px]">
            {qrUrl ? (
              <div ref={qrRef} className="flex flex-col items-center">
                <img
                  src={qrUrl}
                  alt="QR Code"
                  className="w-64 h-64 border border-border rounded-xl shadow-lg"
                  onError={() => toast.error('Error al cargar el QR')}
                />
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium">{mesaActual?.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    Escanea con la cámara de tu celular
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      Abre el menú
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Pide desde tu mesa
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                <QrCode className="size-24 opacity-20 mb-4" />
                <p className="font-medium">Sin QR generado</p>
                <p className="text-sm">Selecciona una mesa y genera su código</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {qrUrl && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Printer className="size-5 text-primary" />
                <span className="font-medium">¿Cómo usar estos QR?</span>
              </div>
              <ol className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  Imprime el QR
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  Pégalo en la mesa
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                  El cliente escanea y pide
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                  El pedido llega a cocina
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}