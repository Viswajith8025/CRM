import React from 'react'
import { DashboardLayout, useDashboardEngine } from '../../dashboardEngineStore'
import { Activity, Target, TrendingUp, Users, CheckCircle, Clock, LineChart } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'

// Dynamic Metric Card
export const DynamicMetricCard = ({ layout }: { layout: DashboardLayout }) => {
  const { performanceLogs, kpis } = useDashboardEngine()
  
  const metric = layout.metrics?.[0]
  if (!metric) return null

  const kpi = kpis.find(k => k.id === metric.kpi_id)
  
  // Calculate value from performance logs
  let total = 0
  const logs = performanceLogs.filter(log => log.kpi_id === metric.kpi_id)
  if (kpi?.aggregation_type === 'sum') {
    total = logs.reduce((acc, curr) => acc + Number(curr.value), 0)
  } else if (kpi?.aggregation_type === 'avg' && logs.length > 0) {
    total = logs.reduce((acc, curr) => acc + Number(curr.value), 0) / logs.length
  } else if (kpi?.aggregation_type === 'count') {
    total = logs.length
  }

  // Format value
  let formattedTotal = total.toString()
  if (kpi?.data_type === 'currency') formattedTotal = `$${total.toFixed(2)}`
  if (kpi?.data_type === 'percentage') formattedTotal = `${total.toFixed(1)}%`
  if (kpi?.data_type === 'time') formattedTotal = `${total.toFixed(1)} hrs`

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/10 flex flex-col justify-between h-full hover:shadow-2xl transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-sky-100 transition-colors pointer-events-none"></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{layout.title}</p>
          <h3 className="text-3xl font-black tracking-tight text-slate-800 group-hover:text-sky-600 transition-colors">
            {formattedTotal}
          </h3>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
          <Activity className="h-5 w-5 text-sky-500" />
        </div>
      </div>
      
      <div className="relative z-10 flex items-center gap-2 text-xs font-bold text-emerald-500 bg-emerald-50/50 w-fit px-2.5 py-1 rounded-xl border border-emerald-100/50">
        <TrendingUp className="h-3 w-3" />
        <span>+14.5% vs last period</span>
      </div>
    </div>
  )
}

// Dynamic Graph Engine
export const DynamicGraphWidget = ({ layout }: { layout: DashboardLayout }) => {
  const { performanceLogs, kpis } = useDashboardEngine()

  // Find the primary metric to plot
  const primaryMetric = layout.metrics?.[0]
  if (!primaryMetric) return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col relative overflow-hidden">
      <h3 className="text-sm font-black text-slate-800 tracking-tight mb-4 flex items-center gap-2">
        <LineChart className="h-4 w-4 text-slate-400" /> {layout.title}
      </h3>
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center px-4">
          No metrics bound to this graph.
        </p>
      </div>
    </div>
  )

  const kpi = kpis.find(k => k.id === primaryMetric.kpi_id)
  
  // Aggregate data by date
  const chartData: any[] = []
  const logs = performanceLogs.filter(log => log.kpi_id === primaryMetric.kpi_id)
  
  // Group by date
  const groupedByDate = logs.reduce((acc: any, log) => {
    if (!acc[log.log_date]) acc[log.log_date] = 0
    acc[log.log_date] += Number(log.value) // Simplified sum
    return acc
  }, {})

  Object.entries(groupedByDate).forEach(([dateStr, val]) => {
    chartData.push({
      date: dateStr,
      value: val
    })
  })

  // Sort by date chronologically
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const gradientId = `color-${layout.id}`
  const graphColor = primaryMetric.color_hex || '#0ea5e9' // sky-500 default

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/10 h-full flex flex-col relative overflow-hidden min-h-[300px]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
            <LineChart className="h-4 w-4 text-sky-500" /> {layout.title}
          </h3>
          {kpi && <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">{kpi.name}</p>}
        </div>
      </div>
      
      <div className="flex-1 w-full -ml-4 mt-2">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
              No historical data for this period
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={graphColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={graphColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                tickFormatter={(val) => {
                  try {
                    return format(parseISO(val), 'MMM d')
                  } catch (e) {
                    return val
                  }
                }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                width={40}
              />
              <RechartsTooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
                labelFormatter={(val) => {
                  try {
                    return format(parseISO(val), 'MMM d, yyyy')
                  } catch (e) {
                    return val
                  }
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={graphColor}
                strokeWidth={3}
                fill={`url(#${gradientId})`}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// Dynamic Layout Renderer
export const DynamicWidgetRenderer = ({ layout }: { layout: DashboardLayout }) => {
  switch (layout.widget_type) {
    case 'metric_card':
      return <DynamicMetricCard layout={layout} />
    case 'graph':
      return <DynamicGraphWidget layout={layout} />
    case 'data_table':
      return <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm col-span-full min-h-[300px]">[Data Table Engine: {layout.title}]</div>
    default:
      return <div className="p-4 border border-dashed border-slate-300 rounded-xl text-xs">Unknown Widget: {layout.widget_code}</div>
  }
}
