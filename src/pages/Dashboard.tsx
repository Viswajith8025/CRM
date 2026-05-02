import {
  Briefcase,
  AlertCircle,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Plus,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useEffect, useMemo, useRef, useCallback } from "react"
import { useTasksStore } from "@/modules/tasks/tasksStore"
import { useProjectsStore } from "@/modules/projects/projectsStore"
import { useBillingStore } from "@/modules/billing/billingStore"
import { useTeamStore } from "@/modules/admin/teamStore"
import { useTimeStore } from "@/modules/time-tracking/timeStore"
import { formatDistanceToNow, subDays, startOfDay, isWithinInterval, format, isAfter, isBefore, parseISO } from "date-fns"
import { toast } from "sonner"
import Grainient from "@/components/ui/Grainient"
import { useCRMStore } from "@/modules/crm/crmStore"
import { useActivityStore } from "@/modules/reports/activityStore"
import { useState } from "react"
import { Calendar as CalendarIcon, Filter } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Dashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartReady, setChartReady] = useState(false)

  const { tasks, fetchTasks } = useTasksStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { invoices, fetchInvoices } = useBillingStore()
  const { members, fetchMembers } = useTeamStore()
  const { logs, fetchLogs } = useTimeStore()
  const { leads, fetchLeads } = useCRMStore()
  const { activities, fetchActivities, subscribeToActivities } = useActivityStore()

  const [filterType, setFilterType] = useState<'all' | 'range'>('all')
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  useEffect(() => {
    fetchTasks()
    fetchProjects()
    fetchInvoices()
    fetchMembers()
    fetchLogs()
    fetchLeads()
    fetchActivities()
    
    const unsubscribe = subscribeToActivities()
    return () => unsubscribe()
  }, [])

  // Defer chart rendering until the container has real dimensions
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          // Add a tiny delay to ensure paint is complete
          setTimeout(() => setChartReady(true), 50)
          observer.disconnect()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredData = useMemo(() => {
    let filteredProjects = projects
    let filteredTasks = tasks
    let filteredInvoices = invoices

    if (filterType === 'range' && dateRange.from && dateRange.to) {
      const from = startOfDay(dateRange.from)
      const to = new Date(dateRange.to.setHours(23, 59, 59, 999))

      filteredProjects = projects.filter(p => {
        const date = new Date(p.created_at)
        return date >= from && date <= to
      })

      filteredTasks = tasks.filter(t => {
        const date = new Date(t.created_at)
        return date >= from && date <= to
      })

      filteredInvoices = invoices.filter(inv => {
        const date = new Date(inv.issued_at)
        return date >= from && date <= to
      })
    }

    return { filteredProjects, filteredTasks, filteredInvoices }
  }, [projects, tasks, invoices, filterType, dateRange])

  const stats = useMemo(() => {
    const { filteredProjects, filteredTasks, filteredInvoices } = filteredData

    const activeProjects = filteredProjects.filter(p => p.status === 'in_progress').length
    const overdueTasks = filteredTasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length

    // All time revenue (always calculated)
    const allTimeRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0)

    // Filtered revenue
    const filteredRevenue = filteredInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0)

    // Utilization: Real logged hours vs capacity (40h/week per member)
    const sevenDaysAgo = subDays(new Date(), 7)
    const weekLogs = logs.filter(log => new Date(log.start_time) >= sevenDaysAgo)
    const totalMinutes = weekLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0)
    const memberCount = members.length || 1
    const totalCapacityMinutes = memberCount * 40 * 60
    const utilization = Math.min(Math.round((totalMinutes / totalCapacityMinutes) * 100), 100)

    return [
      {
        name: filterType === 'all' ? 'Total Revenue' : 'Period Revenue',
        value: `$${filteredRevenue.toLocaleString()}`,
        change: filterType === 'all' ? 'All time earnings' : 'For selected period',
        changeType: 'increase',
        icon: DollarSign,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        path: '/billing'
      },
      {
        name: filterType === 'all' ? 'Active Projects' : 'Projects in Period',
        value: activeProjects.toString(),
        change: `${filteredProjects.filter(p => p.status === 'completed').length} completed`,
        changeType: 'neutral',
        icon: Briefcase,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        path: '/projects'
      },
      {
        name: filterType === 'all' ? 'Overdue Tasks' : 'Tasks in Period',
        value: overdueTasks.toString(),
        change: overdueTasks > 0 ? 'Action required' : 'All clear',
        changeType: overdueTasks > 0 ? 'decrease' : 'increase',
        icon: AlertCircle,
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
        path: '/tasks'
      },
      {
        name: 'Resource Load',
        value: `${utilization}%`,
        change: `${Math.round(totalMinutes / 60)}h logged / 7d`,
        changeType: utilization > 70 ? 'increase' : 'neutral',
        icon: Clock,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        path: '/teams'
      },
    ]
  }, [filteredData, members, logs, invoices, filterType])

  const chartData = useMemo(() => {
    const { filteredInvoices } = filteredData
    
    // Determine the date range for the chart
    let daysCount = 7
    let startFrom = subDays(new Date(), 6)
    
    if (filterType === 'range' && dateRange.from && dateRange.to) {
      // If range is selected, show data for that range (limit to 30 days for readability)
      const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime())
      daysCount = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 30)
      startFrom = dateRange.from
    }

    const days = Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(startFrom)
      d.setDate(startFrom.getDate() + i)
      return {
        date: d,
        name: daysCount > 14 ? format(d, 'MMM d') : format(d, 'EEE')
      }
    })

    return days.map(day => {
      const dailyRev = filteredInvoices
        .filter(inv => {
          const invDate = new Date(inv.issued_at)
          return inv.status === 'paid' &&
            invDate.getDate() === day.date.getDate() &&
            invDate.getMonth() === day.date.getMonth() &&
            invDate.getFullYear() === day.date.getFullYear()
        })
        .reduce((sum, inv) => sum + Number(inv.amount), 0)

      return {
        name: day.name,
        revenue: dailyRev
      }
    })
  }, [filteredData, filterType, dateRange])

  const invoiceMetrics = useMemo(() => {
    const { filteredInvoices } = filteredData
    const paid = filteredInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0)
    const outstanding = filteredInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + Number(i.amount), 0)
    const total = paid + outstanding
    const paidPercentage = total > 0 ? (paid / total) * 100 : 0
    const outstandingPercentage = total > 0 ? (outstanding / total) * 100 : 0

    return { paid, outstanding, paidPercentage, outstandingPercentage }
  }, [filteredData])

  const recentActivity = useMemo(() => {
    return activities.slice(0, 6).map(activity => ({
      id: activity.id,
      user: activity.user?.full_name || 'System',
      action: activity.action,
      target: activity.target_name,
      date: new Date(activity.created_at),
      time: formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
    }))
  }, [activities])

  const upcomingDeadlines = useMemo(() => {
    const { filteredTasks } = filteredData
    return filteredTasks
      .filter(t => t.status !== 'done' && t.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 5)
      .map(task => ({
        id: task.id,
        task: task.title,
        project: task.project?.name || 'General',
        date: format(new Date(task.due_date!), 'MMM d'),
        status: task.priority
      }))
  }, [filteredData])

  return (
    <PageWrapper
      title="Dashboard"
      description="Operational command center with real-time resource and financial tracking."
    >
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[400px] -mr-32 -mt-32 opacity-20 pointer-events-none blur-3xl">
        <Grainient
          color1="#6366f1"
          color2="#a855f7"
          color3="#111111"
          timeSpeed={0.15}
        />
      </div>

      {/* Dashboard Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-card/20 p-4 rounded-2xl border border-border/40 backdrop-blur-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Filter className="h-3 w-3" />
            Data Visibility
          </h2>
          <p className="text-xs text-muted-foreground font-medium">Toggle between all-time stats or a custom date range.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Tabs 
            value={filterType} 
            onValueChange={(v) => setFilterType(v as 'all' | 'range')}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-border/50">
              <TabsTrigger value="all" className="text-xs font-bold uppercase tracking-tight">All Time</TabsTrigger>
              <TabsTrigger value="range" className="text-xs font-bold uppercase tracking-tight">Date Range</TabsTrigger>
            </TabsList>
          </Tabs>

          {filterType === 'range' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 gap-2 border-border/50 bg-background/50 hover:bg-accent/50">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold">
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd")
                      )
                    ) : (
                      "Select date"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.name}
            className="group overflow-hidden transition-all duration-300 hover:shadow-premium-hover hover:-translate-y-1 border-border/50 bg-card/50 cursor-pointer active:scale-95"
            onClick={() => window.location.href = stat.path}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn(stat.bg, "p-3 rounded-xl transition-transform group-hover:scale-110")}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div className={cn(
                  "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter",
                  stat.changeType === 'increase' ? 'bg-emerald-500/10 text-emerald-500' :
                    stat.changeType === 'decrease' ? 'bg-rose-500/10 text-rose-500' : 'bg-muted text-muted-foreground'
                )}>
                  {stat.change}
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{stat.name}</p>
                <h3 className="text-3xl font-black tracking-tighter mt-1">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="lg:col-span-4 border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Revenue Velocity</CardTitle>
            <CardDescription>Daily cash flow from paid invoices over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={chartContainerRef} className="h-[300px] w-full flex items-center justify-center bg-muted/5">
              {chartReady ? (
                <ResponsiveContainer width="99%" height={300} minWidth={0}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Calibrating Chart...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Workspace Activity</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold uppercase tracking-tight"
                onClick={() => window.location.href = '/reports'}
              >
                Full Reports
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-tight">
                      <span className="font-bold text-foreground">{activity.user}</span>{' '}
                      <span className="text-muted-foreground">{activity.action}</span>{' '}
                      <span className="text-primary font-semibold">{activity.target}</span>
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Critical Deadlines</CardTitle>
            <CardDescription>Upcoming project milestones and task due dates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingDeadlines.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-medium border-2 border-dashed rounded-xl">
                  No upcoming deadlines found.
                </div>
              ) : (
                upcomingDeadlines.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group"
                    onClick={() => window.location.href = `/projects/${item.id}`} // Or task detail if implemented
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold tracking-tight">{item.task}</p>
                      <p className="text-xs text-muted-foreground font-medium">{item.project}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{item.date}</p>
                      <div className={cn("h-2 w-2 rounded-full",
                        item.status === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                          item.status === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      )} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Cash Flow Health</CardTitle>
            <CardDescription>Comparison of collected vs outstanding revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Collected</span>
                <span className="text-sm font-black text-emerald-500 tracking-tighter">${invoiceMetrics.paid.toLocaleString()}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border/50">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${invoiceMetrics.paidPercentage}%` }}></div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Outstanding</span>
                <span className="text-sm font-black text-rose-500 tracking-tighter">${invoiceMetrics.outstanding.toLocaleString()}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border/50">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-1000" style={{ width: `${invoiceMetrics.outstandingPercentage}%` }}></div>
              </div>
            </div>
            <div className="pt-4 p-4 rounded-xl bg-accent/30 border border-border/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 text-center">Collection Efficiency</p>
              <p className="text-2xl font-black text-center tracking-tighter">{Math.round(invoiceMetrics.paidPercentage)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
