import {
  Briefcase,
  AlertCircle,
  IndianRupee,
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
import { usePermissions } from "@/hooks/usePermissions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import { useEffect, useMemo, useRef, useCallback, useState } from "react"
import { formatDistanceToNow, subDays, format, startOfDay } from "date-fns"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { useAuthStore } from "@/store/useAuthStore"
import { Calendar as CalendarIcon, Filter } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardGrid } from "@/modules/dashboard/components/DashboardGrid"
import { useDashboardStore, useDashboardDataStore } from "@/modules/dashboard"
import { useAutomationStore } from "@/modules/notifications"
import { DailyTaskList } from "@/modules/time-tracking/components/DailyTaskList"
import { TimeDeskDashboardClock } from "@/modules/time-tracking/components/TimeDeskDashboardClock"
import { MyAssignedTasksWidget } from "@/modules/dashboard/components/widgets/MyAssignedTasksWidget"
import { MyAssignedModulesWidget } from "@/modules/dashboard/components/widgets/MyAssignedModulesWidget"
import { DepartmentIntelligenceCockpit } from "@/modules/dashboard/components/widgets/DepartmentIntelligenceCockpit"
import { useTheme } from "@/hooks/useTheme"
import Grainient from "@/components/ui/Grainient"
import { WorkforceAnalyticsWorkspace } from "@/modules/workforce"

export default function Dashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartReady, setChartReady] = useState(false)
  const { hasPermission } = usePermissions()
  const { profile } = useAuthStore()
  const isEmployee = !hasPermission('module.admin') && !hasPermission('projects.manage')
  const isTeamLead = !hasPermission('module.admin') && hasPermission('projects.manage')
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'departments'>('overview')
  const [workspaceMode, setWorkspaceMode] = useState<'time_desk' | 'analytics'>('time_desk')

  // Default to overview (My Workspace) for Team Leads so they see their own data first
  useEffect(() => {
    if (isTeamLead) {
      setDashboardTab('overview')
    }
  }, [isTeamLead])

  const {
    stats,
    chartData,
    activities,
    isLoading,
    fetchDashboardData,
    fetchChartData,
    fetchRecentActivity
  } = useDashboardDataStore()

  const [filterType, setFilterType] = useState<'all' | 'range'>('all')
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  useEffect(() => {
    const start = filterType === 'range' && dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
    const end = filterType === 'range' && dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined

    fetchDashboardData(start, end)
    fetchChartData(filterType === 'range' ? 30 : 7)
    fetchRecentActivity()
  }, [filterType, dateRange, fetchDashboardData, fetchChartData, fetchRecentActivity])

  // Trigger Smart Reminders once on mount to avoid spamming
  useEffect(() => {
    useAutomationStore.getState().runSmartReminders()
  }, [])

  // Defer chart rendering until the container has real dimensions
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setTimeout(() => {
            if (chartContainerRef.current) setChartReady(true)
          }, 100)
          observer.disconnect()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const dashboardStats = useMemo(() => {
    if (!stats) return []

    return [
      {
        name: filterType === 'all' ? 'Total Revenue' : 'Period Revenue',
        value: `₹${stats.revenue.toLocaleString('en-IN')}`,
        change: filterType === 'all' ? 'All time earnings' : 'For selected period',
        changeType: 'increase',
        icon: IndianRupee,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        path: '/billing',
        permission: 'module.billing'
      },
      {
        name: filterType === 'all' ? 'Active Projects' : 'Projects in Period',
        value: stats.active_projects.toString(),
        change: `Ongoing operations`,
        changeType: 'neutral',
        icon: Briefcase,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        path: '/projects',
        permission: 'module.projects'
      },
      {
        name: filterType === 'all' ? 'Overdue Tasks' : 'Tasks in Period',
        value: stats.overdue_tasks.toString(),
        change: stats.overdue_tasks > 0 ? 'Action required' : 'All clear',
        changeType: stats.overdue_tasks > 0 ? 'decrease' : 'increase',
        icon: AlertCircle,
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
        path: '/tasks',
        permission: 'module.projects'
      },
      {
        name: 'Resource Load',
        value: `${stats.utilization}%`,
        change: `${Math.round(stats.total_minutes / 60)}h logged / 7d`,
        changeType: stats.utilization > 70 ? 'increase' : 'neutral',
        icon: Clock,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        path: '/teams',
        permission: 'module.hr'
      },
    ].filter(stat => {
      if (!stat.permission) return true
      return hasPermission(stat.permission)
    })
  }, [stats, filterType, hasPermission])

  const recentActivity = useMemo(() => {
    return activities.map(activity => ({
      id: activity.id,
      user: activity.actor_name || 'System',
      action: activity.action_type,
      target: activity.target_name,
      date: new Date(activity.created_at),
      time: formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
    }))
  }, [activities])

  const { theme } = useTheme()

  return (
    <PageWrapper
      title="Dashboard"
      description="Operational command center with real-time resource and financial tracking."
    >
      {/* Dynamic Theme Backgrounds */}
      {theme === 'dark' && (
        <div className="absolute top-0 right-0 w-[600px] h-[400px] -mr-32 -mt-32 opacity-20 pointer-events-none blur-3xl transition-opacity duration-1000">
          <Grainient
            color1="#6366f1"
            color2="#a855f7"
            color3="#111111"
            timeSpeed={0.15}
          />
        </div>
      )}

      {/* Tab Switcher for Management/Admin Staff */}
      {!isEmployee && (
        <div className="flex justify-start mb-6">
          <Tabs value={dashboardTab} onValueChange={(val: any) => setDashboardTab(val)} className="w-full sm:w-auto">
            <TabsList className="bg-muted p-1 rounded-xl">
              {!isTeamLead && (
                <TabsTrigger value="overview" className="font-bold text-xs gap-2 px-6">
                  <Briefcase className="h-3.5 w-3.5" />
                  Enterprise Overview
                </TabsTrigger>
              )}
              {isTeamLead && (
                <TabsTrigger value="overview" className="font-bold text-xs gap-2 px-6">
                  <Briefcase className="h-3.5 w-3.5" />
                  My Workspace
                </TabsTrigger>
              )}
              <TabsTrigger value="departments" className="font-bold text-xs gap-2 px-6">
                <Users className="h-3.5 w-3.5" />
                {isTeamLead ? 'My Team Cockpit' : 'Department Intelligence'}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Conditionally Render Cockpit Tabs */}
      {dashboardTab === 'departments' && !isEmployee ? (
        <DepartmentIntelligenceCockpit />
      ) : (
        <>
          {!isEmployee && !isTeamLead && (
            <>
              {/* Dashboard Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-card/40 p-5 rounded-2xl border border-border/40 backdrop-blur-md shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    Data Visibility
                  </h2>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Analyze your metrics by selecting a specific timeframe.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 p-1 bg-background/60 rounded-xl border border-border/50 shadow-inner w-full sm:w-auto">
                  <Button
                    variant={filterType === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn("w-full sm:w-auto h-9 px-6 text-xs font-bold transition-all rounded-lg", filterType === 'all' && "shadow-md bg-primary text-primary-foreground")}
                    onClick={() => setFilterType('all')}
                  >
                    All Time
                  </Button>

                  <div className="w-px h-5 bg-border/50 hidden sm:block"></div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={filterType === 'range' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn("w-full sm:w-auto h-9 px-4 text-xs font-bold gap-2 transition-all rounded-lg", filterType === 'range' && "shadow-md bg-primary text-primary-foreground")}
                        onClick={() => setFilterType('range')}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {filterType === 'range' && dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM dd, yyyy")
                          )
                        ) : (
                          "Custom Range"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4 flex flex-col gap-4 border-border/60 shadow-2xl rounded-xl" align="end">
                      <div className="flex flex-wrap gap-2 pb-4 border-b border-border/40">
                        <Button variant="outline" size="sm" className="flex-1 text-xs font-bold h-8 border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30" onClick={() => { setDateRange({ from: subDays(new Date(), 7), to: new Date() }); setFilterType('range') }}>Last 7 Days</Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs font-bold h-8 border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30" onClick={() => { setDateRange({ from: subDays(new Date(), 30), to: new Date() }); setFilterType('range') }}>Last 30 Days</Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs font-bold h-8 border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30" onClick={() => {
                          const now = new Date();
                          setDateRange({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now });
                          setFilterType('range')
                        }}>This Month</Button>
                      </div>
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from || new Date()}
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range: any) => {
                          setDateRange(range || { from: undefined, to: undefined })
                          setFilterType('range')
                        }}
                        numberOfMonths={2}
                        captionLayout="dropdown"
                        startMonth={new Date(2020, 0)}
                        endMonth={new Date(new Date().getFullYear() + 5, 11)}
                        className="bg-card/50 rounded-lg"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Top Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {dashboardStats.map((stat, i) => (
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
            </>
          )}

          {/* Employee & Team Lead Workspace Toggle & Content */}
          {(isEmployee || isTeamLead) ? (
            <div className="max-w-6xl mx-auto space-y-6 mt-6">
              <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl w-fit">
                <Button
                  variant={workspaceMode === 'time_desk' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setWorkspaceMode('time_desk')}
                  className={cn("text-xs font-bold rounded-lg px-6", workspaceMode === 'time_desk' && "shadow-sm")}
                >
                  Operational Time Desk
                </Button>
                <Button
                  variant={workspaceMode === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setWorkspaceMode('analytics')}
                  className={cn("text-xs font-bold rounded-lg px-6", workspaceMode === 'analytics' && "shadow-sm")}
                >
                  Performance Dashboard
                </Button>
              </div>

              {workspaceMode === 'time_desk' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <TimeDeskDashboardClock />
                  {/* Two-column layout: assigned tasks + daily goals */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <MyAssignedTasksWidget />
                    <DailyTaskList />
                  </div>
                  <MyAssignedModulesWidget />
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <WorkforceAnalyticsWorkspace />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full mb-8">
              {/* Recent Operational Activity log displayed in full-width workspace for Admins/Super Admins */}
              <Card className="bg-card/40 border-border/40 backdrop-blur-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/10 pb-4">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recent Operational Activity</CardTitle>
                    <CardDescription className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mt-0.5">Real-time log of administrative and system events across the tenant.</CardDescription>
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px] border-sky-500/20 bg-sky-500/5 text-sky-500 font-bold tracking-wider">
                    LIVE ACTIVITY STATUS: STABLE
                  </Badge>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {recentActivity.length > 0 ? (
                      recentActivity.slice(0, 6).map((activity) => (
                        <div
                          key={activity.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-border/10 last:border-0 hover:bg-slate-500/5 px-3 rounded-xl transition-all duration-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)] animate-pulse" />
                            <div>
                              <p className="text-xs font-bold text-foreground">
                                {activity.user} <span className="text-muted-foreground font-normal">{activity.action}</span> {activity.target}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider sm:text-right bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md">
                            {activity.time}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No Operational Activities Logged Today</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Customizable Widget Grid */}
          {!isEmployee && !isTeamLead && (
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
          )}
        </>
      )}
    </PageWrapper>
  )
}


