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

import { useEffect, useMemo } from "react"
import { useTasksStore } from "@/modules/tasks/tasksStore"
import { useProjectsStore } from "@/modules/projects/projectsStore"
import { useBillingStore } from "@/modules/billing/billingStore"
import { useTeamStore } from "@/modules/admin/teamStore"
import { useTimeStore } from "@/modules/time-tracking/timeStore"
import { formatDistanceToNow, subDays, startOfDay, isWithinInterval, format } from "date-fns"
import { toast } from "sonner"
import Grainient from "@/components/ui/Grainient"

export default function Dashboard() {
  const { tasks, fetchTasks } = useTasksStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { invoices, fetchInvoices } = useBillingStore()
  const { members, fetchMembers } = useTeamStore()
  const { logs, fetchLogs } = useTimeStore()

  useEffect(() => {
    fetchTasks()
    fetchProjects()
    fetchInvoices()
    fetchMembers()
    fetchLogs()
  }, [])

  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'in_progress').length
    const overdueTasks = tasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length

    // Revenue for current month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthlyRevenue = invoices
      .filter(inv => inv.status === 'paid' && new Date(inv.issued_at) >= monthStart)
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
        name: 'Active Projects',
        value: activeProjects.toString(),
        change: `${projects.filter(p => p.status === 'completed').length} completed`,
        changeType: 'neutral',
        icon: Briefcase,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        path: '/projects'
      },
      {
        name: 'Overdue Tasks',
        value: overdueTasks.toString(),
        change: overdueTasks > 0 ? 'Action required' : 'All clear',
        changeType: overdueTasks > 0 ? 'decrease' : 'increase',
        icon: AlertCircle,
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
        path: '/tasks'
      },
      {
        name: 'Revenue (MTD)',
        value: `$${monthlyRevenue.toLocaleString()}`,
        change: 'Paid invoices only',
        changeType: 'increase',
        icon: DollarSign,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        path: '/billing'
      },
      {
        name: 'Resource Load',
        value: `${utilization}%`,
        change: `${Math.round(totalMinutes / 60)}h logged / 7d`,
        changeType: utilization > 70 ? 'increase' : 'neutral',
        icon: Clock,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        path: '/team'
      },
    ]
  }, [projects, tasks, invoices, members, logs])

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      return {
        date: d,
        name: format(d, 'EEE')
      }
    })

    return days.map(day => {
      const dailyRev = invoices
        .filter(inv => {
          const invDate = new Date(inv.issued_at)
          return inv.status === 'paid' &&
            invDate.getDate() === day.date.getDate() &&
            invDate.getMonth() === day.date.getMonth()
        })
        .reduce((sum, inv) => sum + Number(inv.amount), 0)

      return {
        name: day.name,
        revenue: dailyRev
      }
    })
  }, [invoices])

  const invoiceMetrics = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0)
    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + Number(i.amount), 0)
    const total = paid + outstanding
    const paidPercentage = total > 0 ? (paid / total) * 100 : 0
    const outstandingPercentage = total > 0 ? (outstanding / total) * 100 : 0

    return { paid, outstanding, paidPercentage, outstandingPercentage }
  }, [invoices])

  const recentActivity = useMemo(() => {
    const taskActivities = tasks.slice(0, 5).map(t => ({
      id: `task-${t.id}`,
      user: t.assignee?.full_name || 'System',
      action: 'updated task',
      target: t.title,
      date: new Date(t.updated_at || t.created_at),
      time: formatDistanceToNow(new Date(t.updated_at || t.created_at), { addSuffix: true })
    }))

    const projectActivities = projects.slice(0, 5).map(p => ({
      id: `proj-${p.id}`,
      user: 'Workspace',
      action: 'active project',
      target: p.name,
      date: new Date(p.created_at),
      time: formatDistanceToNow(new Date(p.created_at), { addSuffix: true })
    }))

    return [...taskActivities, ...projectActivities]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6)
  }, [tasks, projects])

  const upcomingDeadlines = useMemo(() => {
    return tasks
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
  }, [tasks])

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
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                <AreaChart data={chartData}>
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
