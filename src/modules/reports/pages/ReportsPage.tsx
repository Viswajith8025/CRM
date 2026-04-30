import { useMemo, useEffect, useState } from "react"
import { useTasksStore } from "@/modules/tasks/tasksStore"
import { useBillingStore } from "@/modules/billing/billingStore"
import { useProjectsStore } from "@/modules/projects/projectsStore"
import { useTeamStore } from "@/modules/admin/teamStore"
import { useCRMStore } from "@/modules/crm/crmStore"
import { useTimeStore } from "@/modules/time-tracking/timeStore"
import { 
  format, 
  subMonths, 
  isWithinInterval, 
  parseISO, 
  startOfDay, 
  endOfDay,
  eachMonthOfInterval,
  isSameMonth
} from "date-fns"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line
} from 'recharts'
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Briefcase, 
  Download, 
  Filter,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"

export default function ReportsPage() {
  const { tasks, fetchTasks } = useTasksStore()
  const { invoices, fetchInvoices } = useBillingStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { members, fetchMembers } = useTeamStore()
  const { leads, fetchLeads } = useCRMStore()
  const { logs, fetchLogs } = useTimeStore()
  
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 5), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => {
    fetchTasks()
    fetchInvoices()
    fetchProjects()
    fetchMembers()
    fetchLeads()
    fetchLogs()
  }, [])

  const isInRange = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = parseISO(dateStr)
    return isWithinInterval(date, {
      start: startOfDay(parseISO(dateRange.start)),
      end: endOfDay(parseISO(dateRange.end))
    })
  }

  const revenueData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: parseISO(dateRange.start),
      end: parseISO(dateRange.end)
    })

    return months.map(month => {
      const monthRevenue = invoices
        .filter(inv => isSameMonth(parseISO(inv.issued_at), month) && inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0)
      
      return {
        month: format(month, 'MMM yyyy'),
        revenue: monthRevenue
      }
    })
  }, [invoices, dateRange])

  const taskStats = useMemo(() => {
    const filteredTasks = tasks.filter(t => isInRange(t.created_at))
    return [
      { name: 'Completed', value: filteredTasks.filter(t => t.status === 'done').length, color: '#10b981' },
      { name: 'In Progress', value: filteredTasks.filter(t => t.status === 'in_progress').length, color: '#f59e0b' },
      { name: 'Review', value: filteredTasks.filter(t => t.status === 'review').length, color: '#3b82f6' },
      { name: 'To Do', value: filteredTasks.filter(t => t.status === 'todo').length, color: '#94a3b8' },
    ].filter(s => s.value > 0)
  }, [tasks, dateRange])

  const employeeProductivity = useMemo(() => {
    return members.map(member => {
      const memberLogs = logs.filter(log => log.user_id === member.id && isInRange(log.start_time))
      const memberTasks = tasks.filter(t => t.assigned_to === member.id && t.status === 'done' && isInRange(t.updated_at))
      
      return {
        name: member.full_name || member.email?.split('@')[0] || 'Unknown',
        hours: Math.round(memberLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / 60),
        tasks: memberTasks.length
      }
    }).sort((a, b) => b.hours - a.hours).slice(0, 8)
  }, [members, logs, tasks, dateRange])

  const leadData = useMemo(() => {
    const filteredLeads = leads.filter(l => isInRange(l.created_at))
    const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won']
    return stages.map(stage => ({
      name: stage.replace('_', ' ').toUpperCase(),
      count: filteredLeads.filter(l => l.status === stage).length
    }))
  }, [leads, dateRange])

  const totals = useMemo(() => {
    const rangeInvoices = invoices.filter(inv => isInRange(inv.issued_at))
    return {
      revenue: rangeInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0),
      pending: rangeInvoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + Number(i.amount), 0),
      projects: projects.filter(p => p.status === 'in_progress').length,
      members: members.length
    }
  }, [invoices, projects, members, dateRange])

  return (
    <PageWrapper 
      title="Business Intelligence" 
      description="Real-time analytics and performance reports derived from workspace data."
      actions={
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
                <Filter className="h-4 w-4 text-primary" />
                Date Range
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Filter Report Range</DialogTitle>
                <DialogDescription>
                  Select the start and end dates to recalculate all workspace analytics.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="start" className="text-right">Start</Label>
                  <Input id="start" type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="end" className="text-right">End</Label>
                  <Input id="end" type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => toast.success("Analytics recalculated for new range")}>Update Dashboard</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button className="gap-2 font-bold" onClick={() => window.print()}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard title="Revenue (Paid)" value={`$${totals.revenue.toLocaleString()}`} icon={TrendingUp} label="Actual collections" />
        <MetricCard title="Pending Invoices" value={`$${totals.pending.toLocaleString()}`} icon={DollarSign} label="Outstanding balance" />
        <MetricCard title="Active Projects" value={totals.projects.toString()} icon={Briefcase} label="Current engagements" />
        <MetricCard title="Team Size" value={totals.members.toString()} icon={Users} label="Active contributors" />
      </div>

      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="financial">Financial Performance</TabsTrigger>
          <TabsTrigger value="operations">Workspace Operations</TabsTrigger>
          <TabsTrigger value="team">Productivity Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Growth</CardTitle>
                <CardDescription>Historical paid revenue grouped by month.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} fontWeight={600} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(v) => `$${v}`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Task Status</CardTitle>
                <CardDescription>Workspace load distribution.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                    <PieChart>
                      <Pie
                        data={taskStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {taskStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Project Lifecycle</CardTitle>
                <CardDescription>Current projects by status.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                    <BarChart data={[
                      { name: 'Planning', count: projects.filter(p => p.status === 'planning').length },
                      { name: 'Active', count: projects.filter(p => p.status === 'in_progress').length },
                      { name: 'Hold', count: projects.filter(p => p.status === 'on_hold').length },
                      { name: 'Done', count: projects.filter(p => p.status === 'completed').length },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Lead Conversion Pipeline</CardTitle>
                <CardDescription>Prospect distribution across sales stages.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={leadData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={9} fontWeight={700} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Line type="stepAfter" dataKey="count" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, fill: '#8b5cf6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Resource Utilization Matrix</CardTitle>
              <CardDescription>Correlation between logged hours and completed tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeProductivity} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} fontSize={11} fontWeight={600} />
                    <Tooltip />
                    <Bar dataKey="hours" name="Logged Hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
                    <Bar dataKey="tasks" name="Tasks Closed" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  )
}

function MetricCard({ title, value, icon: Icon, label }: any) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter opacity-70">{label}</p>
      </CardContent>
    </Card>
  )
}
