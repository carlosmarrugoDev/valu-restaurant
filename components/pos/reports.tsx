'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Download, TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  currency,
  ventasReporte,
  ingresosVsGastos,
  costeoPlatillos,
  cierresCaja,
} from '@/lib/data'

const chartConfig = {
  ingresos: { label: 'Ingresos', color: 'var(--chart-1)' },
  gastos: { label: 'Gastos', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function Reports() {
  const totalIngresos = ventasReporte.reduce((s, v) => s + v.ingresos, 0)
  const totalTx = ventasReporte.reduce((s, v) => s + v.transacciones, 0)
  const utilidadMes = ingresosVsGastos.reduce((s, m) => s + (m.ingresos - m.gastos), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis de ventas, costos y cierres de caja</p>
        </div>
        <Button variant="outline">
          <Download data-icon="inline-start" />
          Exportar CSV
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Ingresos del periodo</CardDescription>
            <CardTitle className="font-display text-2xl">{currency(totalIngresos)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Transacciones</CardDescription>
            <CardTitle className="font-display text-2xl">{totalTx}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Utilidad (6 meses)</CardDescription>
            <CardTitle className="font-display text-2xl text-primary">{currency(utilidadMes)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Ingresos vs Gastos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" />
            Ingresos vs. gastos
          </CardTitle>
          <CardDescription>Comparativo mensual del último semestre</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={ingresosVsGastos} barGap={6}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={52}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Costeo de platillos */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Margen por platillo</CardTitle>
            <CardDescription>Precio de venta contra costo de insumos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {costeoPlatillos.map((c) => {
              const margen = Math.round(((c.precioVenta - c.costoInsumos) / c.precioVenta) * 100)
              return (
                <div key={c.platillo} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.platillo}</span>
                    <span className="text-muted-foreground">
                      {currency(c.costoInsumos)} / {currency(c.precioVenta)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={margen} className="h-2" />
                    <span className="w-10 text-right text-sm font-semibold text-primary">{margen}%</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Cierres de caja */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cierres de caja</CardTitle>
            <CardDescription>Diferencia esperado vs. contado</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cierresCaja.map((c) => {
              const diff = c.contado - c.esperado
              return (
                <div
                  key={c.turno}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{c.turno}</p>
                    <p className="text-xs text-muted-foreground">Esperado {currency(c.esperado)}</p>
                  </div>
                  <Badge variant={diff === 0 ? 'secondary' : diff > 0 ? 'default' : 'destructive'}>
                    {diff > 0 ? '+' : ''}
                    {currency(diff)}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Detalle de ventas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle por turno</CardTitle>
          <CardDescription>Ventas registradas en el periodo</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead className="text-right">Transacciones</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventasReporte.map((v, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{v.fecha}</TableCell>
                  <TableCell>{v.turno}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.transacciones}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{v.metodo}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {currency(v.ingresos)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
