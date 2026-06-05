import { useEffect, useState } from "react"
import { Users, Monitor, Clock, Coffee, AlertCircle, Search, Filter, Download, ArrowUpRight, History, CheckCircle2 } from "lucide-react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTimeDeskStore } from "../timeDeskStore"
import { differenceInMinutes, format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TimeDeskDashboardClock } from "../components/TimeDeskDashboardClock"
import TimeDeskSettings from "./TimeDeskSettings"
import { useAuthStore } from "@/store/useAuthStore"
import { useRBACStore } from "@/modules/admin/rbacStore"

export default function TimeDeskMonitor() {
  const { activeSessions, fetchOrganizationActivity } = useTimeDeskStore()
  const { profile } = useAuthStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "working" | "break">("all")
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [visibleLogsCount, setVisibleLogsCount] = useState(20)

  const { hasPermission } = useRBACStore()
  const isAdminOrSuperAdmin = hasPermission('hr.manage_attendance')

  useEffect(() => {
    fetchOrganizationActivity()
    const interval = setInterval(fetchOrganizationActivity, 30000) // Every 30s
    return () => clearInterval(interval)
  }, [])

  const workingCount = activeSessions.filter(s => !s.break).length
  const breakCount = activeSessions.filter(s => !!s.break).length

  const filtered = activeSessions.filter(s => {
    const matchesSearch = s.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                          s.profile?.email?.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    
    if (statusFilter === 'working') return !s.break
    if (statusFilter === 'break') return !!s.break
    return true
  })

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No data to export.")
      return
    }
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Email,Status,Session Duration,Active Task\n"
      + filtered.map(s => {
          const duration = `${Math.floor(differenceInMinutes(new Date(), new Date(s.start_time)) / 60)}h ${differenceInMinutes(new Date(), new Date(s.start_time)) % 60}m`
          const taskName = s.activeTaskName?.replace(/"/g, '""') || 'No Task Started'
          return `"${s.profile?.full_name}","${s.profile?.email}","${s.break ? 'On Break' : 'Working'}","${duration}","${taskName}"`
      }).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `timedesk_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export successful!")
  }

  const handleViewLogs = async (session: any) => {
    setSelectedSession(session)
    setIsLogsLoading(true)
    try {
      // 1. Fetch ALL breaks for this session
      const { data: breaks } = await supabase
        .from('break_sessions')
        .select('*')
        .eq('work_session_id', session.id)
        .order('start_time', { ascending: true })

      // 2. Fetch tasks for this user on this day
      const sessionDate = format(new Date(session.start_time), 'yyyy-MM-dd')
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', session.user_id)
        .eq('task_date', sessionDate)

      // 3. Combine into a timeline
      const timeline = [
        { type: 'check_in', time: session.start_time, label: 'Checked In', color: 'bg-emerald-500' },
        ...(breaks || []).flatMap((b: any) => [
          { type: 'break_start', time: b.start_time, label: `Break Started: ${b.type.replace('_', ' ')}`, color: 'bg-amber-500' },
          ...(b.end_time ? [{ type: 'break_end', time: b.end_time, label: `Break Ended`, color: 'bg-amber-400' }] : [])
        ]),
        ...(tasks || []).map((t: any) => ({
          type: 'task',
          time: t.created_at,
          label: `Task Logged: ${t.title}`,
          color: 'bg-sky-500',
          status: t.status
        }))
      ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

      setLogs(timeline)
      setVisibleLogsCount(20) // Reset visible count on open
    } catch (err) {
      toast.error("Failed to load activity logs")
    } finally {
      setIsLogsLoading(false)
    }
  }

  return (
    <PageWrapper 
      title="Time Monitor Hub" 
      description="Centralized operational hub for tracking live employee activity, managing personal timesheets, and governing shift policies."
      className="bg-slate-50 dark:bg-slate-950 min-h-screen pb-12"
    >
      <Tabs defaultValue="activity" className="space-y-8">
        <TabsList className={cn(
          "grid w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm",
          isAdminOrSuperAdmin ? "max-w-md grid-cols-2" : "max-w-lg grid-cols-3"
        )}>
          <TabsTrigger value="activity" className="text-xs font-black uppercase py-3 rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
            Live Activity
          </TabsTrigger>
          {!isAdminOrSuperAdmin && (
            <TabsTrigger value="clock" className="text-xs font-black uppercase py-3 rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              Personal Clock Desk
            </TabsTrigger>
          )}
          <TabsTrigger value="settings" className="text-xs font-black uppercase py-3 rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
            Rules & Governance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-8 outline-none">
          {/* STAT METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/80 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Online Now</p>
                      <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mt-1">{activeSessions.length}</h3>
                    </div>
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary shadow-inner">
                      <Monitor className="h-7 w-7" />
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full w-fit shadow-sm border border-emerald-100 dark:border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live Monitoring Active
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-none shadow-lg shadow-primary/20 overflow-hidden relative">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-primary-foreground/80">Currently Working</p>
                      <h3 className="text-4xl font-black tracking-tighter mt-1 text-white">{workingCount}</h3>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/20 text-white backdrop-blur-sm border border-white/20">
                      <Clock className="h-7 w-7" />
                    </div>
                  </div>
                  <p className="mt-7 text-[10px] text-primary-foreground/80 font-black uppercase tracking-widest">Active sessions without breaks</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none shadow-lg shadow-amber-500/20 overflow-hidden relative">
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-amber-100">On Break</p>
                      <h3 className="text-4xl font-black tracking-tighter mt-1">{breakCount}</h3>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/20 text-white backdrop-blur-sm border border-white/20">
                      <Coffee className="h-7 w-7" />
                    </div>
                  </div>
                  <p className="mt-7 text-[10px] text-amber-100 font-black uppercase tracking-widest">Employees in pause state</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* FILTERS & SEARCH */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-md">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search employees..." 
                className="pl-11 h-11 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm font-bold placeholder:font-medium placeholder:text-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto px-2 pb-2 sm:px-0 sm:pb-0 sm:pr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 gap-2 h-10 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-xs uppercase tracking-wider">
                    <Filter className="h-4 w-4" />
                    {statusFilter === 'all' ? 'All Status' : statusFilter === 'working' ? 'Working Only' : 'On Break Only'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl font-bold">
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <DropdownMenuRadioItem value="all" className="text-xs uppercase tracking-wider cursor-pointer">All Status</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="working" className="text-xs uppercase tracking-wider cursor-pointer text-emerald-600">Working Only</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="break" className="text-xs uppercase tracking-wider cursor-pointer text-amber-600">On Break Only</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={handleExport} className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 gap-2 h-10 font-black text-xs uppercase tracking-wider shadow-sm transition-all hover:shadow-md">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* ACTIVE SESSIONS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filtered.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
                    <div className={cn(
                      "absolute top-0 left-0 h-1 w-full transition-colors duration-500",
                      session.break ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-primary shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                    )} />
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <Avatar className={cn(
                            "h-12 w-12 border-2 shadow-sm ring-4 ring-offset-2 ring-offset-white dark:ring-offset-slate-900",
                            session.break ? "border-amber-200 ring-amber-50 dark:ring-amber-900/20" : "border-primary/20 ring-primary/5 dark:ring-primary/10"
                          )}>
                            <AvatarImage src={session.profile?.avatar_url} />
                            <AvatarFallback className={cn(
                              "font-black text-lg",
                              session.break ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary"
                            )}>
                              {session.profile?.full_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none uppercase text-sm group-hover:text-primary transition-colors">
                              {session.profile?.full_name}
                            </h4>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 uppercase flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              IN AT {format(new Date(session.start_time), 'hh:mm a')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                          session.break ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-primary/5 dark:bg-primary/10 border-primary/20 text-primary"
                        )}>
                          {session.break ? session.break.type.replace('_', ' ') : "Working"}
                        </Badge>
                      </div>

                      <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between group/item">
                          <div className="flex items-center gap-2 text-slate-400 group-hover/item:text-slate-600 dark:group-hover/item:text-slate-300 transition-colors">
                            <Clock className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Duration</span>
                          </div>
                          <span className="text-base font-black text-slate-700 dark:text-slate-200 tabular-nums">
                            {Math.floor(differenceInMinutes(new Date(), new Date(session.start_time)) / 60)}<span className="text-xs text-slate-400 mx-0.5">h</span>{differenceInMinutes(new Date(), new Date(session.start_time)) % 60}<span className="text-xs text-slate-400 ml-0.5">m</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between group/item">
                          <div className="flex items-center gap-2 text-slate-400 group-hover/item:text-slate-600 dark:group-hover/item:text-slate-300 transition-colors">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Task</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg max-w-[150px] truncate border border-slate-200 dark:border-slate-700">
                            {session.activeTaskName || 'No Task Started'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Button 
                          variant="secondary" 
                          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                          onClick={() => handleViewLogs(session)}
                        >
                          View Activity Log
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {filtered.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="col-span-full py-24 text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800"
              >
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 mb-6 shadow-inner">
                  <Monitor className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-xl font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">No matching sessions</h3>
                <p className="text-sm font-bold text-slate-400 mt-2 max-w-sm mx-auto">Either all employees are currently offline or no one matches your search filters.</p>
              </motion.div>
            )}
          </div>
        </TabsContent>

        {!isAdminOrSuperAdmin && (
          <TabsContent value="clock" className="outline-none">
            <TimeDeskDashboardClock />
          </TabsContent>
        )}

        <TabsContent value="settings" className="outline-none">
          <TimeDeskSettings />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-widest flex items-center gap-3 text-slate-800 dark:text-slate-100">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <History className="h-5 w-5" />
              </div>
              Activity Log: {selectedSession?.profile?.full_name}
            </DialogTitle>
            <DialogDescription className="text-[11px] uppercase font-bold text-slate-500 tracking-wider pt-2">
              Full shift timeline including check-ins, breaks, and tasks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
            {isLogsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 dark:text-slate-500 text-xs uppercase font-black tracking-widest">
                  No activity recorded yet
                </p>
              </div>
            ) : (
              <div className="relative space-y-8 ml-4 border-l-2 border-slate-200 dark:border-slate-800 pl-8">
                {logs.slice(0, visibleLogsCount).map((log, i) => (
                  <div key={i} className="relative group">
                    <div className={cn(
                      "absolute -left-[41px] h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 shadow-sm transition-transform group-hover:scale-110 duration-300",
                      log.color
                    )} />
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.time), 'hh:mm a')}
                      </p>
                      <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        {log.label}
                      </h5>
                      {log.status && (
                        <Badge variant="outline" className="mt-3 text-[9px] font-black uppercase py-0.5 px-2 rounded-md border-slate-200 dark:border-slate-700">
                          {log.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                {logs.length > visibleLogsCount && (
                  <div className="pt-6 pb-2 text-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setVisibleLogsCount(prev => prev + 20)}
                      className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Load More Events ({logs.length - visibleLogsCount} remaining)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
