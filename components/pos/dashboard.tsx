'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  CalendarRange,
  Receipt,
  Armchair,
  TriangleAlert,
  CircleAlert,
} from 'lucide-react'

import {
  currency,
  currencyDetailed,
  dashboardMetrics,
  ventasPorHora,
  platillosTop,
  ultimasTransacciones,
  alertas,
} from '@/lib/data'
import { cn } from '@/lib/utils'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const m = dashboardMetrics

const metricCards = [
  {
    label: 'Ventas del día',
    value: currency(m.ventasDia),
    delta: m.ventasDiaDelta,
    icon: Banknote,
  },
  {
    label: 'Ventas de la semana',
    value: currency(m.ventasSemana),
    delta: m.ventasSemanaDelta,
    icon: CalendarRange,
  },
  {
    label: 'Ticket promedio',
    value: currency(m.ticketPromedio),
    delta: m.ticketPromedioDelta,
    icon: Receipt,
  },
  {
    label: 'Mesas ocupadas',
    value: `${m.mesasOcupadas}/${m.mesasTotales}`,
    sub: 'ahora mismo',
    icon: Armchair,
  },
]

const ventasChartConfig = {
  ventas: { label: 'Ventas', color: 'var(--chart-1)' },
} satisfies ChartConfig

const platillosChartConfig = {
  vendidos: { label: 'Vendidos', color: 'var(--chart-1)' },
} satisfies ChartConfig

const metodoVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  Tarjeta: 'default',
  Efectivo: 'secondary',
  Digital: 'outline',
}

export function Dashboard() {
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
                      {positive ? (
                        <TrendingUp className="size-3.5" />
                      ) : (
                        <TrendingDown className="size-3.5" />
                      )}
                      {positive ? '+' : ''}
                      {card.delta}%
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
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => currency(Number(value))}
                    />
                  }
                />
                <Area
                  dataKey="ventas"
                  type="natural"
                  fill="url(#fillVentas)"
                  stroke="var(--color-ventas)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Platillos más vendidos</CardTitle>
            <CardDescription>Top 5 de hoy</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={platillosChartConfig} className="h-[280px] w-full">
              <BarChart
                data={platillosTop}
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
                <Bar dataKey="vendidos" fill="var(--color-vendidos)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Transacciones + alertas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Últimas transacciones</CardTitle>
            <CardDescription>Cierres de cuenta recientes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Mesa</TableHead>
                  <TableHead className="hidden sm:table-cell">Mesero</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasTransacciones.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.id}
                    </TableCell>
                    <TableCell className="font-medium">{t.mesa}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {t.mesero}
                    </TableCell>
                    <TableCell>
                      <Badge variant={metodoVariant[t.metodo]}>{t.metodo}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {currencyDetailed(t.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Requieren tu atención</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alertas.map((a) => {
              const critico = a.nivel === 'critico'
              const Icon = critico ? CircleAlert : TriangleAlert
              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3',
                    critico
                      ? 'border-destructive/30 bg-destructive/8'
                      : 'border-border bg-muted/40',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      critico ? 'text-destructive' : 'text-status-bill',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{a.mensaje}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {a.tipo === 'stock' ? 'Inventario' : 'Servicio'} ·{' '}
                      {critico ? 'Crítico' : 'Aviso'}
                    </p>
                  </div>
                </div>
              )
            })}
            <Separator className="my-1" />
            <p className="text-center text-xs text-muted-foreground">
              {alertas.length} alertas activas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
