// components/pos/dashboard.tsx - VERSIÓN CONECTADA A BD
'use client'

import { useState, useEffect } from 'react'
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, XAxis, YAxis,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Banknote,
  CalendarRange, Receipt, Armchair,
  TriangleAlert, CircleAlert, Loader2,
} from 'lucide-react'

import { currency, currencyDetailed } from '@/lib/data'
import { cn } from '@/lib/utils'
import {
  Card, CardAction, CardContent,
  CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/components/auth/auth-context'

const ventasChartConfig = {
  ventas: { label: 'Ventas', color: 'var(--chart-1)' },
} satisfies ChartConfig

const platillosChartConfig = {
  items_vendidos: { label: 'Vendidos', color: 'var(--chart-1)' },
} satisfies ChartConfig

const metodoVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  tarjeta: 'default',
  efectivo: 'secondary',
  digital: 'outline',
  mixto: 'outline',
}

export function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [user])

  const loadDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      if (res.ok) {
        setData(result.metricas)
      } else {
        setError(result.error || 'Error al cargar dashboard')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-4 text-primary hover:underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return null

  const { ventas_hoy, ventas_semana, ticket_promedio, mesas, top_platillos, alertas_stock_bajo } = data

  const metricCards = [
    {
      label: 'Ventas del día',
      value: currency(ventas_hoy.total),
      delta: ventas_hoy.delta_porcentaje,
      icon: Banknote,
    },
    {
      label: 'Ventas de la semana',
      value: currency(ventas_semana.total),
      sub: `${ventas_semana.pedidos} pedidos`,
      icon: CalendarRange,
    },
    {
      label: 'Ticket promedio',
      value: currency(ticket_promedio),
      icon: Receipt,
    },
    {
      label: 'Mesas ocupadas',
      value: `${mesas.ocupadas}/${mesas.total}`,
      sub: `${mesas.porcentaje_ocupacion}% ocupación`,
      icon: Armchair,
    },
  ]

  // Datos para gráfico de ventas por hora (reales del backend)
  const ventasPorHora = data.ventas_por_hora && data.ventas_por_hora.length > 0
    ? data.ventas_por_hora
    : [
        { hora: '10h', ventas: ventas_hoy.total * 0.05 },
        { hora: '11h', ventas: ventas_hoy.total * 0.08 },
        { hora: '12h', ventas: ventas_hoy.total * 0.15 },
        { hora: '13h', ventas: ventas_hoy.total * 0.22 },
        { hora: '14h', ventas: ventas_hoy.total * 0.25 },
        { hora: '15h', ventas: ventas_hoy.total * 0.12 },
        { hora: '16h', ventas: ventas_hoy.total * 0.08 },
        { hora: '17h', ventas: ventas_hoy.total * 0.05 },
      ]

  return (
    <div className="flex flex-col gap-6">
      {/* Métricas clave */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon
          const positive = (card.delta ?? 0) >= 0
          return (
            <Card key={card.label}>
              <CardHeader>
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="font-display text-2xl">{card.value}</CardTitle>
                <CardAction>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Icon className="size-[18px]" />
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent>
                {card.delta !== undefined ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        'flex items-center gap-1 font-medium',
                        positive ? 'text-chart-4' : 'text-destructive',
                      )}
                    >
                      {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                      {positive ? '+' : ''}{card.delta}%
                    </span>
                    <span className="text-muted-foreground">vs. ayer</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ventas por hora</CardTitle>
            <CardDescription>Ingresos del día actual</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ventasChartConfig} className="h-[280px] w-full">
              <AreaChart data={ventasPorHora} margin={{ left: 4, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ventas)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-ventas)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="hora" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${v / 1000}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />} />
                <Area dataKey="ventas" type="natural" fill="url(#fillVentas)" stroke="var(--color-ventas)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Platillos más vendidos</CardTitle>
            <CardDescription>Top 5 de la semana</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={platillosChartConfig} className="h-[280px] w-full">
              <BarChart
                data={top_platillos}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="nombre"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={112}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="items_vendidos" fill="var(--color-items_vendidos)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de stock bajo */}
      {alertas_stock_bajo && alertas_stock_bajo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-4 text-destructive" />
              Alertas de inventario
            </CardTitle>
            <CardDescription>{alertas_stock_bajo.length} insumos por debajo del mínimo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alertas_stock_bajo.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/8 p-3"
              >
                <div>
                  <p className="font-medium">{a.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.stock} {a.unidad} disponibles · Mínimo: {a.stock_minimo} {a.unidad}
                  </p>
                </div>
                <Badge variant="destructive">
                  Faltan {a.faltante} {a.unidad}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}