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
import { Badge } from "@/components/ui/badge"
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
import { motion } from "framer-motion"
import Grainient from "@/components/ui/Grainient"
import { useCRMStore } from "@/modules/crm/store/crmStore"
import { useActivityStore } from "@/modules/reports/activityStore"
import { useState } from "react"
import { Calendar as CalendarIcon, Filter } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardGrid } from "@/modules/dashboard/components/DashboardGrid"
import { useDashboardStore } from "@/modules/dashboard/dashboardStore"

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

      {/* Top Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-card/40 border-border/40 backdrop-blur-md hover:border-primary/50 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-2 rounded-lg", stat.bg)}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                      {stat.change}
                    </span>
                    <Badge variant="outline" className="text-[10px] mt-1 border-primary/20 bg-primary/5 text-primary">
                      {stat.name === 'Overdue Tasks' && stat.value !== '0' ? 'ACTION REQUIRED' : 'STABLE'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {stat.name}
                  </h3>
                  <div className="text-3xl font-black tracking-tighter">
                    {stat.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Customizable Widget Grid */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Plus className="h-3 w-3" />
              Dynamic Workspace
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase">Personalize your command center layout.</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase border-border/50 bg-background/30" onClick={() => useDashboardStore.getState().resetLayout()}>
            Reset Default Layout
          </Button>
        </div>
        <DashboardGrid />
      </div>
    </PageWrapper>
  )
}
