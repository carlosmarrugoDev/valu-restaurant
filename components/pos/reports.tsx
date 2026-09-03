// components/pos/reports.tsx - VERSIÓN CONECTADA
'use client'

import { useState, useEffect } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Download, TrendingUp, Loader2 } from 'lucide-react'

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { currency } from '@/lib/data'
import { useAuth } from '@/components/auth/auth-context'

const chartConfig = {
  ingresos: { label: 'Ingresos', color: 'var(--chart-1)' },
  gastos: { label: 'Gastos', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function Reports() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [user])

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reportes')
      const result = await res.json()
      if (res.ok) {
        setData(result)
      } else {
        setError(result.error || 'Error al cargar reportes')
      }
    } catch {
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
        <button onClick={loadReports} className="mt-4 text-primary hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  // Datos reales del backend para el gráfico
  const ingresosVsGastos = data?.ingresos_vs_gastos || [
    { mes: 'Ene', ingresos: 0, gastos: 0 },
    { mes: 'Feb', ingresos: 0, gastos: 0 },
    { mes: 'Mar', ingresos: 0, gastos: 0 },
    { mes: 'Abr', ingresos: 0, gastos: 0 },
    { mes: 'May', ingresos: 0, gastos: 0 },
    { mes: 'Jun', ingresos: 0, gastos: 0 },
  ]

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
            <CardDescription>Ventas del día</CardDescription>
            <CardTitle className="font-display text-2xl">
              {currency(data?.metricas?.ventas_hoy?.total || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ventas de la semana</CardDescription>
            <CardTitle className="font-display text-2xl">
              {currency(data?.metricas?.ventas_semana?.total || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ticket promedio</CardDescription>
            <CardTitle className="font-display text-2xl text-primary">
              {currency(data?.metricas?.ticket_promedio || 0)}
            </CardTitle>
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
    </div>
  )
}