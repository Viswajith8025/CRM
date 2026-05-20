import { useEffect, useState } from "react"
import { Users, Monitor, Clock, Coffee, AlertCircle, Search, Filter, Download, ArrowUpRight, History } from "lucide-react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTimeDeskStore } from "../timeDeskStore"
import { differenceInMinutes, format } from "date-fns"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { TimeDeskDashboardClock } from "../components/TimeDeskDashboardClock"
import TimeDeskSettings from "./TimeDeskSettings"
import { useAuthStore } from "@/store/useAuthStore"

export default function TimeDeskMonitor() {
  const { activeSessions, fetchOrganizationActivity } = useTimeDeskStore()
  const { profile } = useAuthStore()
  const [search, setSearch] = useState("")
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)

  const isAdminOrSuperAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  useEffect(() => {
    fetchOrganizationActivity()
    const interval = setInterval(fetchOrganizationActivity, 30000) // Every 30s
    return () => clearInterval(interval)
  }, [])

  const filtered = activeSessions.filter(s => 
    s.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.profile?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const workingCount = filtered.filter(s => !s.break).length
  const breakCount = filtered.filter(s => !!s.break).length

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
    >
      <Tabs defaultValue="activity" className="space-y-6">
        <TabsList className={cn(
          "grid w-full bg-slate-100 rounded-2xl p-1 border",
          isAdminOrSuperAdmin ? "max-w-md grid-cols-2" : "max-w-lg grid-cols-3"
        )}>
          <TabsTrigger value="activity" className="text-xs font-black uppercase py-2.5 rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Live Activity
          </TabsTrigger>
          {!isAdminOrSuperAdmin && (
            <TabsTrigger value="clock" className="text-xs font-black uppercase py-2.5 rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Personal Clock Desk
            </TabsTrigger>
          )}
          <TabsTrigger value="settings" className="text-xs font-black uppercase py-2.5 rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Rules & Governance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border/40 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Online Now</p>
                    <h3 className="text-3xl font-black text-foreground tracking-tighter mt-1">{filtered.length}</h3>
                  </div>
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <Monitor className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-lg w-fit">
                  <ArrowUpRight className="h-3 w-3" />
                  Live Monitoring Active
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/40 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Currently Working</p>
                    <h3 className="text-3xl font-black text-primary tracking-tighter mt-1">{workingCount}</h3>
                  </div>
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-4 text-[10px] text-muted-foreground font-bold uppercase">Active sessions without breaks</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-sky-100 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">On Break</p>
                    <h3 className="text-3xl font-black text-amber-500 tracking-tighter mt-1">{breakCount}</h3>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 text-amber-500">
                    <Coffee className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase">Employees in pause state</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-4 mt-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search employees..." 
                className="pl-10 border-sky-100 focus-visible:ring-sky-500 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl border-sky-100 text-sky-600 gap-2 h-10">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl border-sky-100 text-sky-600 gap-2 h-10">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {filtered.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-card border-border/40 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <div className={cn(
                    "h-1.5 w-full",
                    session.break ? "bg-amber-400" : "bg-primary"
                  )} />
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarImage src={session.profile?.avatar_url} />
                          <AvatarFallback className="bg-sky-50 text-sky-600 font-black">
                            {session.profile?.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-black text-slate-800 tracking-tight leading-none uppercase text-sm">
                            {session.profile?.full_name}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                            Checked in at {format(new Date(session.start_time), 'hh:mm a')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-2",
                        session.break ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-sky-50 border-sky-200 text-sky-600"
                      )}>
                        {session.break ? session.break.type.replace('_', ' ') : "Working"}
                      </Badge>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Session Duration</span>
                        </div>
                        <span className="text-sm font-black text-slate-700 tabular-nums">
                          {Math.floor(differenceInMinutes(new Date(), new Date(session.start_time)) / 60)}h {differenceInMinutes(new Date(), new Date(session.start_time)) % 60}m
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Active Task</span>
                        </div>
                        <span className="text-[10px] font-black text-sky-600 bg-sky-50 px-2 py-1 rounded-lg max-w-[180px] truncate">
                          {session.activeTaskName || 'No Task Started'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Button 
                        variant="ghost" 
                        className="w-full text-sky-600 hover:bg-sky-50 font-black text-[10px] uppercase tracking-widest rounded-xl"
                        onClick={() => handleViewLogs(session)}
                      >
                        View Activity Log
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Monitor className="h-12 w-12 mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">No active sessions found</h3>
                <p className="text-xs text-slate-400 mt-2">All employees are currently offline.</p>
              </div>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-widest flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Activity Log: {selectedSession?.profile?.full_name}
            </DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Full shift timeline including check-ins, breaks, and tasks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 overflow-y-auto max-h-[60vh]">
            {isLogsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs uppercase font-bold">
                No activity recorded yet
              </div>
            ) : (
              <div className="relative space-y-6 ml-4 border-l-2 border-slate-100 pl-6">
                {logs.map((log, i) => (
                  <div key={i} className="relative">
                    <div className={cn(
                      "absolute -left-[31px] h-4 w-4 rounded-full border-4 border-white shadow-sm",
                      log.color
                    )} />
                    <div className="bg-card border border-border/40 p-3 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">
                        {format(new Date(log.time), 'hh:mm a')}
                      </p>
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                        {log.label}
                      </h5>
                      {log.status && (
                        <Badge variant="outline" className="mt-2 text-[8px] font-black uppercase py-0 px-1.5 h-4 border-slate-200">
                          {log.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
