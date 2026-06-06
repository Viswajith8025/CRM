import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useTeamStore } from '@/modules/admin'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle2, Clock, TrendingUp, Calendar, Target, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts'
import { format, parseISO, subDays, differenceInMinutes } from 'date-fns'
import { cn } from '@/lib/utils'
import { BDEReportsAdminView } from '@/modules/bde/components/BDEReportsAdminView'

interface DailyStats {
  date: string
  tasks_completed: number
  hours_logged: number
}

interface PerfStats {
  bdeStats: {
    totalLeadsGenerated: number
    totalLeadsConverted: number
    leadsJustdial: number
    leadsSocialMedia: number
    leadsDatabase: number
    leadsOthers: number
  } | null
  totalTasksDone: number
  totalHoursLogged: number
  avgTasksPerDay: number
  completionRate: number
  trend: DailyStats[]
}

export function WorkforceAnalyticsWorkspace() {
  const { profile } = useAuthStore()
  const [stats, setStats] = useState<PerfStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<7 | 14 | 30>(30)

  const { members, fetchMembers } = useTeamStore()
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])
  const currentUserMember = members.find(m => m.id === profile?.id)
  const isBDEOrSales = profile?.dynamic_role?.toLowerCase() === 'sales' || 
                       profile?.dynamic_role?.toLowerCase() === 'salesperson' || 
                       profile?.role?.toLowerCase() === 'salesperson' ||
                       currentUserMember?.department?.toLowerCase().includes('bde') || 
                       currentUserMember?.department?.toLowerCase().includes('business development') ||
                       currentUserMember?.department?.toLowerCase().includes('sales')

  useEffect(() => {
    if (!profile?.id) return
    fetchStats()
  }, [profile?.id, period, isBDEOrSales])

  const fetchStats = async () => {
    if (!profile?.id) return
    setIsLoading(true)
    try {
      const startDate = subDays(new Date(), period).toISOString().split('T')[0]
      const endDate = new Date().toISOString().split('T')[0]

      // Fetch tasks (non-deleted) assigned to this user in the period
      const { data: taskData } = await supabase
        .from('tasks')
        .select('id, status, created_at, updated_at')
        .eq('assigned_to', profile.id)
        .is('deleted_at', null)
        .gte('created_at', `${startDate}T00:00:00`)

      // Fetch work sessions in the period
      const { data: sessionData } = await supabase
        .from('work_sessions')
        .select('id, start_time, end_time, status')
        .eq('user_id', profile.id)
        .gte('start_time', `${startDate}T00:00:00`)
        .order('start_time', { ascending: true })

      const tasks = taskData || []
      const sessions = sessionData || []

      // Build daily map for the last N days
      const dailyMap: Record<string, DailyStats> = {}
      for (let i = period - 1; i >= 0; i--) {
        const d = subDays(new Date(), i).toISOString().split('T')[0]
        dailyMap[d] = { date: d, tasks_completed: 0, hours_logged: 0 }
      }

      // Tasks completed by date (use updated_at for done tasks)
      tasks.forEach(t => {
        if (t.status === 'done') {
          const d = t.updated_at?.split('T')[0]
          if (d && dailyMap[d]) {
            dailyMap[d].tasks_completed++
          }
        }
      })

      // Hours logged per session date
      sessions.forEach(s => {
        const d = s.start_time.split('T')[0]
        if (dailyMap[d]) {
          const start = new Date(s.start_time)
          const end = s.end_time ? new Date(s.end_time) : new Date()
          const mins = differenceInMinutes(end, start)
          dailyMap[d].hours_logged += mins / 60
        }
      })

      const trend = Object.values(dailyMap)
      const totalTasksDone = trend.reduce((s, d) => s + d.tasks_completed, 0)
      const totalHoursLogged = trend.reduce((s, d) => s + d.hours_logged, 0)
      const daysWithTasks = trend.filter(d => d.tasks_completed > 0).length
      const avgTasksPerDay = daysWithTasks > 0 ? totalTasksDone / daysWithTasks : 0
      const totalTasks = tasks.length
      const completionRate = totalTasks > 0 ? (tasks.filter(t => t.status === 'done').length / totalTasks) * 100 : 0

      let bdeStats = null
      if (isBDEOrSales) {
        const { data: bdeData } = await supabase
          .from('bde_daily_reports')
          .select('*')
          .eq('user_id', profile.id)
          .gte('report_date', startDate)
          
        const reports = bdeData || []
        
        bdeStats = {
          totalLeadsGenerated: reports.reduce((s, r) => s + (Number(r.database_count) || 0) + (Number(r.leads_social_media) || 0) + (Number(r.leads_just_dial) || 0) + (Number(r.leads_other) || 0), 0),
          totalLeadsConverted: reports.reduce((s, r) => s + (Number(r.meetings_scheduled) || 0), 0),
          leadsJustdial: reports.reduce((s, r) => s + (Number(r.leads_just_dial) || 0), 0),
          leadsSocialMedia: reports.reduce((s, r) => s + (Number(r.leads_social_media) || 0), 0),
          leadsDatabase: reports.reduce((s, r) => s + (Number(r.database_count) || 0), 0),
          leadsOthers: reports.reduce((s, r) => s + (Number(r.leads_other) || 0), 0)
        }
      }

      setStats({
        totalTasksDone,
        totalHoursLogged,
        avgTasksPerDay,
        completionRate,
        trend,
        bdeStats
      })
    } catch (err) {
      console.error('Failed to load performance stats:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            My Performance Dashboard
          </h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
            Real-time personal productivity analytics
          </p>
        </div>
        <div className="flex gap-2">
          {([7, 14, 30] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all",
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
            Crunching your performance data...
          </p>
        </div>
      ) : stats ? (
        <>

          {isBDEOrSales && stats.bdeStats ? (
            <>
              {/* BDE KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                  icon={<Target className="h-5 w-5 text-indigo-500" />}
                  bg="bg-indigo-500/10"
                  label="Leads Generated"
                  value={stats.bdeStats.totalLeadsGenerated.toString()}
                  sub={`Last ${period} days`}
                />
                <KpiCard
                  icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  bg="bg-emerald-500/10"
                  label="Leads Converted"
                  value={stats.bdeStats.totalLeadsConverted.toString()}
                  sub={`Last ${period} days`}
                />
                <KpiCard
                  icon={<Clock className="h-5 w-5 text-blue-500" />}
                  bg="bg-blue-500/10"
                  label="Hours Logged"
                  value={`${stats.totalHoursLogged.toFixed(1)}h`}
                  sub={`Last ${period} days`}
                />
                <KpiCard
                  icon={<BarChart2 className="h-5 w-5 text-amber-500" />}
                  bg="bg-amber-500/10"
                  label="Conversion Rate"
                  value={`${stats.bdeStats.totalLeadsGenerated > 0 ? ((stats.bdeStats.totalLeadsConverted / stats.bdeStats.totalLeadsGenerated) * 100).toFixed(0) : 0}%`}
                  sub="Converted / Generated"
                />
              </div>

              {/* BDE Pie Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Conversion Ratio */}
                <Card className="bg-card/40 border-border/40 backdrop-blur-md">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-500" />
                      Lead Conversion Ratio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 min-h-[220px] flex items-center justify-center">
                    {stats.bdeStats.totalLeadsGenerated > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Converted', value: stats.bdeStats.totalLeadsConverted, color: '#10b981' },
                              { name: 'Not Converted', value: stats.bdeStats.totalLeadsGenerated - stats.bdeStats.totalLeadsConverted, color: '#f43f5e' }
                            ]}
                            cx="50%" cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {
                              [
                                { name: 'Converted', value: stats.bdeStats.totalLeadsConverted, color: '#10b981' },
                                { name: 'Not Converted', value: stats.bdeStats.totalLeadsGenerated - stats.bdeStats.totalLeadsConverted, color: '#f43f5e' }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))
                            }
                          </Pie>
                          <ChartTooltip formatter={(value) => [`${value} Leads`, 'Count']} />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">No Leads Data Available</div>
                    )}
                  </CardContent>
                </Card>

                {/* Lead Sources */}
                <Card className="bg-card/40 border-border/40 backdrop-blur-md">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-indigo-500" />
                      Lead Sources Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 min-h-[220px] flex items-center justify-center">
                    {stats.bdeStats.totalLeadsGenerated > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Justdial', value: stats.bdeStats.leadsJustdial, color: '#3b82f6' },
                              { name: 'Social Media', value: stats.bdeStats.leadsSocialMedia, color: '#a855f7' },
                              { name: 'Database', value: stats.bdeStats.leadsDatabase, color: '#f59e0b' },
                              { name: 'Others', value: stats.bdeStats.leadsOthers, color: '#64748b' }
                            ].filter(d => d.value > 0)}
                            cx="50%" cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {
                              [
                                { name: 'Justdial', value: stats.bdeStats.leadsJustdial, color: '#3b82f6' },
                                { name: 'Social Media', value: stats.bdeStats.leadsSocialMedia, color: '#a855f7' },
                                { name: 'Database', value: stats.bdeStats.leadsDatabase, color: '#f59e0b' },
                                { name: 'Others', value: stats.bdeStats.leadsOthers, color: '#64748b' }
                              ].filter(d => d.value > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))
                            }
                          </Pie>
                          <ChartTooltip formatter={(value) => [`${value} Leads`, 'Count']} />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">No Lead Source Data Available</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <>
              {/* Regular Non-Sales KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCard
                  icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  bg="bg-emerald-500/10"
                  label="Tasks Completed"
                  value={stats.totalTasksDone.toString()}
                  sub={`Last ${period} days`}
                />
                <KpiCard
                  icon={<Clock className="h-5 w-5 text-blue-500" />}
                  bg="bg-blue-500/10"
                  label="Hours Logged"
                  value={`${stats.totalHoursLogged.toFixed(1)}h`}
                  sub={`Last ${period} days`}
                />
                <KpiCard
                  icon={<Target className="h-5 w-5 text-violet-500" />}
                  bg="bg-violet-500/10"
                  label="Completion Rate"
                  value={`${stats.completionRate.toFixed(0)}%`}
                  sub="Of all assigned tasks"
                />
                <KpiCard
                  icon={<BarChart2 className="h-5 w-5 text-amber-500" />}
                  bg="bg-amber-500/10"
                  label="Avg Tasks / Day"
                  value={stats.avgTasksPerDay.toFixed(1)}
                  sub="On active days"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Tasks Completed Trend */}
            <Card className="bg-card/40 border-border/40 backdrop-blur-md">
              <CardHeader className="border-b border-border/10 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Tasks Completed — Daily Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 min-h-[220px]">
                {stats.trend.some(d => d.tasks_completed > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stats.trend}>
                      <defs>
                        <linearGradient id="grad-tasks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" stroke="#888" fontSize={10} tickLine={false} axisLine={false}
                        tickFormatter={d => {
                          try { return format(parseISO(d), 'dd MMM') } catch { return d }
                        }}
                        interval={Math.floor(stats.trend.length / 6)}
                      />
                      <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip
                        formatter={(v: any) => [v, 'Tasks Done']}
                        labelFormatter={d => { try { return format(parseISO(d), 'MMM dd, yyyy') } catch { return d } }}
                      />
                      <Area type="monotone" dataKey="tasks_completed" stroke="#10b981" fill="url(#grad-tasks)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center">
                      <CheckCircle2 className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">No tasks completed yet</p>
                      <p className="text-[10px] text-slate-300">Complete tasks to see your trend here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hours Logged Trend */}
            <Card className="bg-card/40 border-border/40 backdrop-blur-md">
              <CardHeader className="border-b border-border/10 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Hours Logged — Daily Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 min-h-[220px]">
                {stats.trend.some(d => d.hours_logged > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" stroke="#888" fontSize={10} tickLine={false} axisLine={false}
                        tickFormatter={d => {
                          try { return format(parseISO(d), 'dd MMM') } catch { return d }
                        }}
                        interval={Math.floor(stats.trend.length / 6)}
                      />
                      <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false}
                        tickFormatter={v => `${v.toFixed(0)}h`}
                      />
                      <ChartTooltip
                        formatter={(v: any) => [`${Number(v).toFixed(1)}h`, 'Hours']}
                        labelFormatter={d => { try { return format(parseISO(d), 'MMM dd, yyyy') } catch { return d } }}
                      />
                      <Bar dataKey="hours_logged" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center">
                      <Clock className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">No sessions logged yet</p>
                      <p className="text-[10px] text-slate-300">Sign in to the time desk to see your hours</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
            </>
          )}

          {/* Streak / Calendar View */}
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Activity Heatmap — Last {period} Days
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {stats.trend.map(day => {
                  const heat = day.tasks_completed === 0 ? 0 :
                    day.tasks_completed <= 2 ? 1 :
                    day.tasks_completed <= 4 ? 2 :
                    day.tasks_completed <= 6 ? 3 : 4
                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.tasks_completed} tasks, ${day.hours_logged.toFixed(1)}h`}
                      className={cn(
                        "w-5 h-5 rounded-sm transition-all cursor-default",
                        heat === 0 && "bg-slate-100 dark:bg-slate-800",
                        heat === 1 && "bg-emerald-100 dark:bg-emerald-900",
                        heat === 2 && "bg-emerald-300 dark:bg-emerald-700",
                        heat === 3 && "bg-emerald-500",
                        heat === 4 && "bg-emerald-700"
                      )}
                    />
                  )
                })}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Less</span>
                {[0,1,2,3,4].map(h => (
                  <div key={h} className={cn("w-3.5 h-3.5 rounded-sm",
                    h === 0 && "bg-slate-100 dark:bg-slate-800",
                    h === 1 && "bg-emerald-100",
                    h === 2 && "bg-emerald-300",
                    h === 3 && "bg-emerald-500",
                    h === 4 && "bg-emerald-700"
                  )} />
                ))}
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">More</span>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* Admin specific views */}
      {profile && ['super_admin', 'admin', 'manager'].includes(profile.role) && (
        <BDEReportsAdminView />
      )}
    </div>
  )
}

function KpiCard({ icon, bg, label, value, sub }: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  sub: string
}) {
  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-md hover:border-primary/50 transition-all">
      <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", bg)}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-black tracking-tighter mt-0.5">{value}</p>
          <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-1">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}
