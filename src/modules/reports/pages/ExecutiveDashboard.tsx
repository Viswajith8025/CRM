import React, { useMemo, useEffect, useState } from 'react'
import { PageWrapper } from '@/components/shared/PageWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Briefcase, 
  AlertCircle, 
  DollarSign, 
  Clock, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Target,
  BarChart3,
  RefreshCcw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useBillingStore } from '@/modules/billing'
import { useProjectsStore } from '@/modules/projects'

interface ExecutiveMetrics {
  revenue: {
    current_month: number
    prev_month: number
    growth: number
  }
  sales: {
    conversion_rate: number
    total_leads: number
    converted_leads: number
  }
  billing: {
    overdue_count: number
    overdue_amount: number
  }
  projects: {
    total: number
    at_risk: number
    risk_percentage: number
  }
  team: {
    size: number
  }
}

export default function ExecutiveDashboard() {
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const { invoices, fetchInvoices } = useBillingStore()
  const { projects, fetchProjects } = useProjectsStore()

  const fetchMetrics = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_executive_metrics')
      if (error) throw error
      setMetrics(data)
    } catch (err) {
      console.error("Failed to fetch executive metrics:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    fetchInvoices({ limit: 100 })
    fetchProjects({ limit: 100 })
    
    // Defer chart rendering until the container has real dimensions
    const el = chartContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setTimeout(() => setIsReady(true), 150)
          observer.disconnect()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Dynamic Metrics (Synchronized with Billing Store)
  const dynamicMetrics = useMemo(() => {
    const now = new Date()
    const startOfCurrentMonth = startOfMonth(now)
    
    const monthlyRevenue = invoices
      .filter(inv => inv.status === 'paid' && new Date(inv.issued_at || inv.created_at) >= startOfCurrentMonth)
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)

    const totalInvoiced = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
    const capitalAtRisk = totalInvoiced - totalPaid
    
    const overdueCount = invoices.filter(inv => 
      inv.status === 'overdue' || (inv.status === 'sent' && new Date(inv.due_date) < now)
    ).length

    return { monthlyRevenue, capitalAtRisk, overdueCount }
  }, [invoices])

  // Revenue Trend Data (Historical)
  const revenueTrend = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i))
    return months.map(month => {
      const label = format(month, 'MMM')
      const total = invoices
        .filter(inv => inv.status === 'paid' && isWithinInterval(new Date(inv.issued_at || inv.created_at), { start: startOfMonth(month), end: endOfMonth(month) }))
        .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
      return { name: label, amount: total }
    })
  }, [invoices])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <PageWrapper 
      title="Executive Control Center" 
      description="Real-time strategic performance and organizational health metrics."
      actions={
        <Button variant="outline" size="sm" onClick={fetchMetrics} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Sync Data
        </Button>
      }
    >
      {/* KPI Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Monthly Revenue */}
        <Card className="group border-border/50 bg-card/30 backdrop-blur-xl hover:bg-card/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Revenue</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">{formatCurrency(dynamicMetrics.monthlyRevenue)}</div>
            <div className="flex items-center gap-1 mt-1">
              {metrics.revenue.growth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-rose-500" />
              )}
              <span className={cn("text-xs font-bold", metrics.revenue.growth >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {Math.abs(metrics.revenue.growth)}% <span className="text-muted-foreground font-medium">vs last month</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="group border-border/50 bg-card/30 backdrop-blur-xl hover:bg-card/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Conversion</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
              <Target className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">{metrics.sales.conversion_rate}%</div>
            <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-tight">
              {metrics.sales.converted_leads} Clients from {metrics.sales.total_leads} Leads
            </p>
          </CardContent>
        </Card>

        {/* Project Risk */}
        <Card className="group border-border/50 bg-card/30 backdrop-blur-xl hover:bg-card/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Org Risk Index</CardTitle>
            <div className="p-2 rounded-lg bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors">
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">{metrics.projects.at_risk} / {metrics.projects.total}</div>
            <div className="mt-2">
              <Progress value={metrics.projects.risk_percentage} className="h-1 bg-rose-500/20" />
            </div>
          </CardContent>
        </Card>

        {/* Overdue Capital */}
        <Card className="group border-border/50 bg-card/30 backdrop-blur-xl hover:bg-card/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Capital at Risk</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-rose-500">{formatCurrency(dynamicMetrics.capitalAtRisk)}</div>
            <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-tight">
              {dynamicMetrics.overdueCount} Overdue Invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Performance */}
        <Card className="lg:col-span-2 border-border/50 bg-card/30 backdrop-blur-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">Revenue Performance</CardTitle>
              <CardDescription>6-month rolling financial trend</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent ref={chartContainerRef} className="h-[350px] w-full pt-4 min-h-[350px]">
            {isReady && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} 
                    tickFormatter={(val) => `₹${val/1000}k`}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#10b981', strokeWidth: 2 }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'black' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#10b981" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Project Health Index */}
        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold">Health Distribution</CardTitle>
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <CardDescription>Organization-wide project health</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col h-full justify-between pb-8">
            <div className="space-y-6">
              {[
                { label: 'On-Track', status: 'on-track', color: 'bg-emerald-500' },
                { label: 'At-Risk', status: 'at-risk', color: 'bg-amber-500' },
                { label: 'Delayed', status: 'delayed', color: 'bg-rose-500' }
              ].map((item) => {
                const count = projects.filter(p => p.health?.status === item.status).length
                const percentage = (count / (projects.length || 1)) * 100
                return (
                  <div key={item.status} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-tight">
                      <span className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", item.color)} />
                        {item.label}
                      </span>
                      <span>{count}</span>
                    </div>
                    <Progress value={percentage} className={cn("h-2 bg-muted/20", item.color.replace('bg-', 'text-'))} />
                  </div>
                )
              })}
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center shadow-inner">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Global Score</p>
                  <p className="text-2xl font-black tracking-tighter">
                    {Math.round(projects.reduce((acc, p) => acc + (p.health?.score || 0), 0) / (projects.length || 1))}/100
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
