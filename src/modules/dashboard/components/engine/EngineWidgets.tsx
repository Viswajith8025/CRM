import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, BarChart as BarChartIcon, PieChart, TrendingUp, Users, Target, Briefcase } from 'lucide-react'
import { useDashboardEngine } from '../../dashboardEngineStore'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

const ICON_MAP: Record<string, any> = {
  'activity': Activity,
  'trending': TrendingUp,
  'users': Users,
  'target': Target,
  'briefcase': Briefcase,
}

export function DynamicWidgetRenderer({ layout }: { layout: any }) {
  if (layout.widget_type === 'metric_card') {
    return <DynamicMetricCard layout={layout} />
  }

  if (layout.widget_type === 'graph') {
    return <DynamicGraphWidget layout={layout} />
  }

  // Fallback for unhandled dynamic widget types
  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
          {layout.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[250px] flex items-center justify-center border-t border-border/10">
        <span className="text-xs text-muted-foreground">{layout.widget_type} (Dynamic UI Render Target)</span>
      </CardContent>
    </Card>
  )
}

function DynamicMetricCard({ layout }: { layout: any }) {
  const { performanceLogs } = useDashboardEngine()
  
  // A metric card usually focuses on the primary metric tied to it
  const primaryMetric = layout.metrics?.[0]
  const kpi = primaryMetric?.kpi

  const Icon = ICON_MAP[layout.config?.icon || 'activity'] || Activity

  // Aggregate value based on KPI rules from logs
  const aggregatedValue = useMemo(() => {
    if (!kpi || !performanceLogs.length) return 0
    const relevantLogs = performanceLogs.filter(log => log.kpi_id === kpi.id)
    
    if (relevantLogs.length === 0) return 0

    if (kpi.aggregation_type === 'sum') {
      return relevantLogs.reduce((acc, log) => acc + Number(log.value), 0)
    }
    if (kpi.aggregation_type === 'avg') {
      const sum = relevantLogs.reduce((acc, log) => acc + Number(log.value), 0)
      return sum / relevantLogs.length
    }
    if (kpi.aggregation_type === 'max') {
      return Math.max(...relevantLogs.map(log => Number(log.value)))
    }
    
    // Default fallback
    return relevantLogs[relevantLogs.length - 1].value
  }, [performanceLogs, kpi])

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-md hover:border-primary/50 transition-all h-full">
      <CardContent className="p-5 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-background/50 text-primary">
            <Icon className="h-5 w-5" style={{ color: primaryMetric?.color_hex || '#0ea5e9' }} />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{layout.title}</h3>
          <div className="text-2xl font-black tracking-tighter">
            {kpi?.data_type === 'currency' ? '$' : ''}
            {Number(aggregatedValue).toLocaleString()}
            {kpi?.data_type === 'percentage' ? '%' : ''}
          </div>
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
            Aggregated via {kpi?.aggregation_type || 'system'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function DynamicGraphWidget({ layout }: { layout: any }) {
  const { performanceLogs } = useDashboardEngine()

  const primaryMetric = layout.metrics?.[0]
  const kpi = primaryMetric?.kpi

  const chartData = useMemo(() => {
    if (!kpi || !performanceLogs.length) return []
    const relevantLogs = performanceLogs.filter(log => log.kpi_id === kpi.id)
    
    // Group by log_date
    const grouped = relevantLogs.reduce((acc: any, log) => {
      const date = log.log_date
      if (!acc[date]) acc[date] = 0
      acc[date] += Number(log.value)
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, val]) => ({
        date: format(parseISO(date), 'MMM dd'),
        value: val
      }))
  }, [performanceLogs, kpi])

  const chartColor = primaryMetric?.color_hex || '#0ea5e9'

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-md h-full flex flex-col">
      <CardHeader className="border-b border-border/10 pb-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <BarChartIcon className="h-4 w-4" />
          {layout.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex-1 min-h-[250px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {layout.config?.chart_type === 'bar' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <ChartTooltip />
                <Bar dataKey="value" fill={chartColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${layout.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <ChartTooltip />
                <Area type="monotone" dataKey="value" stroke={chartColor} fillOpacity={1} fill={`url(#gradient-${layout.id})`} strokeWidth={2.5} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
              Insufficient Data Logs
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
