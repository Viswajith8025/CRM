import { useEffect, useState, useMemo } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { format, differenceInMinutes } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Calendar as CalendarIcon, CheckSquare, Coffee, LogIn, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { isSameDay, isSameWeek, isSameMonth, parseISO } from "date-fns"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TimesheetEntry {
  id: string
  start_time: string
  end_time: string | null
  status: string
  breaks: any[]
  tasks: any[]
}

export default function MyTimesheetPage() {
  const { profile } = useAuthStore()
  const [sessions, setSessions] = useState<TimesheetEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month' | 'all'>('week')

  useEffect(() => {
    async function fetchTimesheet() {
      if (!profile?.id) return
      
      try {
        // Fetch work sessions with their breaks and daily tasks
        const { data, error } = await supabase
          .from('work_sessions')
          .select(`
            *,
            break_sessions(*)
          `)
          .eq('user_id', profile.id)
          .order('start_time', { ascending: false })
          .limit(30) // Last 30 sessions

        if (error) throw error

        const { data: taskData } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', profile.id)
          .order('task_date', { ascending: false })
          .limit(200)

        const tasks = taskData || []
        
        const mappedSessions = (data as any || []).map((session: any) => {
          const sessionDate = session.start_time.split('T')[0]
          return {
            ...session,
            daily_tasks: tasks.filter(t => t.task_date === sessionDate)
          }
        })

        setSessions(mappedSessions)
      } catch (err) {
        console.error("Failed to load timesheet:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTimesheet()
  }, [profile?.id])

  const filteredSessions = useMemo(() => {
    const now = new Date()
    return sessions.filter(session => {
      if (filterType === 'all') return true
      const sessionDate = parseISO(session.start_time)
      if (filterType === 'day') return isSameDay(sessionDate, now)
      if (filterType === 'week') return isSameWeek(sessionDate, now, { weekStartsOn: 1 })
      if (filterType === 'month') return isSameMonth(sessionDate, now)
      return true
    })
  }, [sessions, filterType])

  const totals = useMemo(() => {
    let totalMinutes = 0
    let totalTasksCompleted = 0

    filteredSessions.forEach(session => {
      const workStart = new Date(session.start_time)
      const workEnd = session.end_time ? new Date(session.end_time) : new Date()
      const grossMinutes = differenceInMinutes(workEnd, workStart)

      const breakMinutes = session.break_sessions?.reduce((acc, b) => {
        if (!b.end_time) return acc
        return acc + differenceInMinutes(new Date(b.end_time), new Date(b.start_time))
      }, 0) || 0

      totalMinutes += (grossMinutes - breakMinutes)
      totalTasksCompleted += (session.daily_tasks?.filter(t => t.is_completed).length || 0)
    })

    return {
      hours: Math.floor(Math.max(0, totalMinutes) / 60),
      minutes: Math.max(0, totalMinutes) % 60,
      tasks: totalTasksCompleted
    }
  }, [filteredSessions])

  if (isLoading) {
    return (
      <PageWrapper title="My Timesheet" description="Loading your daily performance...">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper 
      title="My Timesheet" 
      description="Evaluate your daily sign-ins, breaks, and completed tasks."
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Tabs value={filterType} onValueChange={(val: any) => setFilterType(val)} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 w-full sm:w-[400px]">
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">Productive Time</p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">{totals.hours}h {totals.minutes}m</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckSquare className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">Tasks Done</p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tighter text-emerald-600">{totals.tasks}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-10 border rounded-xl border-dashed">
            <Clock className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p className="font-bold">No sessions found</p>
            <p className="text-sm text-muted-foreground">No sessions match the selected filter.</p>
          </div>
        ) : (
          filteredSessions.map(session => {
            const workStart = new Date(session.start_time)
            const workEnd = session.end_time ? new Date(session.end_time) : new Date()
            const totalMinutes = differenceInMinutes(workEnd, workStart)
            const hours = Math.floor(totalMinutes / 60)
            const mins = totalMinutes % 60

            const totalBreakMinutes = session.break_sessions?.reduce((acc, b) => {
              if (!b.end_time) return acc
              return acc + differenceInMinutes(new Date(b.end_time), new Date(b.start_time))
            }, 0) || 0

            return (
              <Card key={session.id} className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/20 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{format(workStart, 'EEEE, MMM do, yyyy')}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={session.status === 'completed' ? 'secondary' : 'default'} className="text-[10px] uppercase font-black">
                            {session.status}
                          </Badge>
                          <span className="text-xs font-bold text-muted-foreground">
                            {hours}h {mins}m total
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Timeline */}
                  <div className="space-y-4 border-r border-border/40 pr-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Shift Details</h4>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <LogIn className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Sign In</p>
                        <p className="text-xs text-muted-foreground">{format(workStart, 'hh:mm a')}</p>
                      </div>
                    </div>
                    
                    {session.end_time && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                          <LogOut className="h-4 w-4 text-rose-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Sign Off</p>
                          <p className="text-xs text-muted-foreground">{format(workEnd, 'hh:mm a')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Breaks */}
                  <div className="space-y-4 border-r border-border/40 pr-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Breaks ({totalBreakMinutes}m)</h4>
                      <Coffee className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {session.break_sessions?.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No breaks taken.</p>
                    ) : (
                      <div className="space-y-2">
                        {session.break_sessions?.map(b => (
                          <div key={b.id} className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded-md">
                            <span className="font-bold capitalize">{b.type.replace('_', ' ')}</span>
                            <span className="text-muted-foreground">
                              {b.end_time 
                                ? `${differenceInMinutes(new Date(b.end_time), new Date(b.start_time))}m` 
                                : 'Active'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Completed Tasks</h4>
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {session.daily_tasks?.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No tasks recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {session.daily_tasks?.map(t => (
                          <div key={t.id} className="flex items-start gap-2 text-xs">
                            <CheckSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className={t.is_completed ? "text-muted-foreground line-through" : "font-medium"}>
                              {t.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </PageWrapper>
  )
}
