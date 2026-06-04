import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { usePermissions } from "@/hooks/usePermissions"
import { format, differenceInMinutes } from "date-fns"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Calendar as CalendarIcon, Filter, Search, UserCircle, Coffee, CheckSquare, ChevronDown, BarChart2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Flag, Building2 } from "lucide-react"
import { useDepartmentStore } from "@/modules/dashboard/useDepartmentStore"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TeamSession {
  id: string
  start_time: string
  end_time: string | null
  status: string
  profile: {
    full_name: string
    avatar_url: string
    role: string
  }
  break_sessions: any[]
  all_tasks: { id: string, title: string, is_completed: boolean, type: string }[]
  is_flagged?: boolean
  admin_note?: string
}

export default function TeamTimesheetsPage() {
  const { profile } = useAuthStore()
  const { hasPermission } = usePermissions()
  const [sessions, setSessions] = useState<TeamSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDept, setSelectedDept] = useState("all")
  const [dateFilter, setDateFilter] = useState("today")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedSession, setSelectedSession] = useState<TeamSession | null>(null)
  const [bdeReport, setBdeReport] = useState<any>(null)
  const { departments, fetchDepartments } = useDepartmentStore()

  useEffect(() => {
    fetchDepartments()
  }, [])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [adjustData, setAdjustData] = useState({ start_time: "", end_time: "", admin_note: "" })

  useEffect(() => {
    if (!selectedSession) {
      setBdeReport(null)
      return
    }
    const sessionDate = selectedSession.start_time.split('T')[0]
    
    async function fetchBdeReport() {
      const { data } = await supabase
        .from('bde_daily_reports')
        .select('*')
        .eq('employee_id', (selectedSession as any).user_id)
        .eq('report_date', sessionDate)
        .maybeSingle()
      setBdeReport(data)
    }
    fetchBdeReport()
  }, [selectedSession])

  useEffect(() => {
    async function fetchTeamTimesheets() {
      if (!profile?.organization_id) return
      
      try {
        const canManageAll = profile?.role === 'super_admin' || hasPermission('hr.manage_attendance')
        let allowedUserIds: string[] | null = null

        // If not a full admin, scope to the team lead's department
        if (!canManageAll) {
          const { data: deptData } = await supabase
            .from('department_members')
            .select('department_id')
            .eq('profile_id', profile.id)
            .eq('is_primary', true)
            .limit(1)

          if (deptData && deptData.length > 0) {
            const { data: members } = await supabase
              .from('department_members')
              .select('profile_id')
              .eq('department_id', deptData[0].department_id)
            
            allowedUserIds = (members || []).map(m => m.profile_id)
          } else {
            // No department assigned, return empty results
            allowedUserIds = ['00000000-0000-0000-0000-000000000000']
          }
        }

        let sessionQuery = supabase
          .from('work_sessions')
          .select(`
            *,
            profile:profiles(full_name, avatar_url, role),
            break_sessions(*)
          `)
          .eq('organization_id', profile.organization_id)
          .order('start_time', { ascending: false })
          .limit(100)

        if (allowedUserIds) {
          sessionQuery = sessionQuery.in('user_id', allowedUserIds)
        }

        const { data, error } = await sessionQuery

        if (error) throw error

        // Fetch recent tasks for the org separately since there's no FK
        const { data: taskData } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('task_date', { ascending: false })
          .limit(500)

        const tasks = taskData || []
        
        const { data: officialTaskData } = await supabase
          .from('tasks')
          .select('id, title, status, assigned_to, updated_at, created_at')
          .eq('organization_id', profile.organization_id)
          .is('deleted_at', null)
          .limit(2000)

        const officialTasks = officialTaskData || []

        // Fetch department mappings to support filtering
        const { data: deptMembers } = await supabase
          .from('department_members')
          .select('profile_id, department_id')

        const deptMap = new Map()
        if (deptMembers) {
           deptMembers.forEach((m: any) => {
             deptMap.set(m.profile_id, m.department_id)
           })
        }

        const mappedSessions = (data as any || []).map((session: any) => {
          const sessionDate = session.start_time.split('T')[0]
          
          const dTasks = tasks.filter(t => t.user_id === session.user_id && t.task_date === sessionDate).map((t: any) => ({
            id: t.id, title: t.title, is_completed: t.is_completed, type: 'self'
          }))
          
          const oTasks = officialTasks.filter(t => t.assigned_to === session.user_id && (t.updated_at.split('T')[0] === sessionDate || t.created_at.split('T')[0] === sessionDate)).map((t: any) => ({
            id: t.id, title: t.title, is_completed: (t.status === 'done' || t.status === 'completed'), type: 'assigned'
          }))
          
          // Deduplicate just in case
          const all_tasks = [...dTasks, ...oTasks].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)

          return {
            ...session,
            all_tasks,
            department_id: deptMap.get(session.user_id)
          }
        })

        setSessions(mappedSessions)
      } catch (err) {
        console.error("Failed to load team timesheets:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTeamTimesheets()
  }, [profile?.organization_id])

  const toggleFlag = async (session: TeamSession) => {
    try {
      const { error } = await supabase
        .from('work_sessions')
        .update({ is_flagged: !session.is_flagged })
        .eq('id', session.id)

      if (error) throw error

      setSessions(prev => prev.map(s => 
        s.id === session.id ? { ...s, is_flagged: !session.is_flagged } : s
      ))
      
      toast.success(session.is_flagged ? "Flag removed" : "Shift flagged for review")
    } catch (err) {
      toast.error("Failed to update flag status")
    }
  }

  const handleAdjustTime = async () => {
    if (!selectedSession) return

    try {
      const { error } = await supabase
        .from('work_sessions')
        .update({ 
          start_time: new Date(adjustData.start_time).toISOString(),
          end_time: adjustData.end_time ? new Date(adjustData.end_time).toISOString() : null,
          admin_note: adjustData.admin_note
        })
        .eq('id', selectedSession.id)

      if (error) throw error

      setSessions(prev => prev.map(s => 
        s.id === selectedSession.id ? { 
          ...s, 
          start_time: new Date(adjustData.start_time).toISOString(),
          end_time: adjustData.end_time ? new Date(adjustData.end_time).toISOString() : null,
          admin_note: adjustData.admin_note
        } : s
      ))
      
      setIsAdjustOpen(false)
      toast.success("Time adjusted successfully")
    } catch (err) {
      toast.error("Failed to adjust time")
    }
  }

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = selectedDept === "all" || (s as any).department_id === selectedDept
    
    // Status Filter
    let matchesStatus = true
    if (statusFilter === 'active') matchesStatus = s.status === 'active'
    if (statusFilter === 'completed') matchesStatus = s.status === 'completed'
    if (statusFilter === 'flagged') matchesStatus = !!s.is_flagged

    // Date Filter
    let matchesDate = true
    const sessionDate = new Date(s.start_time)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const isSameDay = (d1: Date, d2: Date) => 
      d1.getDate() === d2.getDate() && 
      d1.getMonth() === d2.getMonth() && 
      d1.getFullYear() === d2.getFullYear()

    if (dateFilter === 'today') {
      matchesDate = isSameDay(sessionDate, today)
    } else if (dateFilter === 'yesterday') {
      matchesDate = isSameDay(sessionDate, yesterday)
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      matchesDate = sessionDate >= weekAgo
    }

    return matchesSearch && matchesDept && matchesStatus && matchesDate
  })

  return (
    <PageWrapper 
      title="Team Timesheets" 
      description="Evaluate and audit organization-wide daily sign-ins, breaks, and tasks."
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by employee name..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Department" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Date Range" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">Loading team records...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">No timesheets found</h3>
                  <p className="text-sm text-muted-foreground">No team members have logged shifts yet.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Breaks</TableHead>
                    <TableHead>Tasks Done</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => {
                    const workStart = new Date(session.start_time)
                    const workEnd = session.end_time ? new Date(session.end_time) : new Date()
                    const totalMinutes = differenceInMinutes(workEnd, workStart)
                    const hours = Math.floor(totalMinutes / 60)
                    const mins = totalMinutes % 60

                    const totalBreakMinutes = session.break_sessions?.reduce((acc, b) => {
                      if (!b.end_time) return acc
                      return acc + differenceInMinutes(new Date(b.end_time), new Date(b.start_time))
                    }, 0) || 0
                    
                    const completedTasks = session.all_tasks?.filter((t: any) => t.is_completed).length || 0
                    const totalTasks = session.all_tasks?.length || 0

                    return (
                      <TableRow key={session.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border-2 border-background shadow-sm">
                              <AvatarImage src={session.profile?.avatar_url} />
                              <AvatarFallback><UserCircle className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-sm">{session.profile?.full_name || 'Unknown'}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black">{session.profile?.role}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={cn(session.is_flagged && "bg-amber-50/50")}>
                          <div className="flex flex-col relative">
                            {session.is_flagged && (
                              <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                                <Flag className="h-3 w-3 text-amber-500 fill-current" />
                              </div>
                            )}
                            <span className="font-medium text-sm">{format(workStart, 'MMM d, yyyy')}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(workStart, 'HH:mm')} - {session.end_time ? format(new Date(session.end_time), 'HH:mm') : 'Active'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-sm">{hours}h {mins}m</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Coffee className="h-3 w-3" />
                            {totalBreakMinutes > 0 ? `${totalBreakMinutes}m` : 'None'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <CheckSquare className="h-3 w-3 text-emerald-500" />
                            {completedTasks} / {totalTasks}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={session.status === 'completed' ? 'secondary' : 'default'} className="text-[10px] uppercase font-black">
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-2 text-xs">
                                Evaluate <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedSession(session)
                                setIsDetailsOpen(true)
                              }}>
                                View Detailed Log
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedSession(session)
                                setAdjustData({
                                  start_time: session.start_time.slice(0, 16),
                                  end_time: session.end_time ? session.end_time.slice(0, 16) : "",
                                  admin_note: session.admin_note || ""
                                })
                                setIsAdjustOpen(true)
                              }}>
                                Adjust Time
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-amber-500 font-bold flex items-center justify-between"
                                onClick={() => toggleFlag(session)}
                              >
                                {session.is_flagged ? "Unflag Shift" : "Flag Shift"}
                                {session.is_flagged && <Flag className="h-3.5 w-3.5 fill-current" />}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detailed Log Modal */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedSession?.profile?.avatar_url} />
                  <AvatarFallback><UserCircle /></AvatarFallback>
                </Avatar>
                <div>
                  <p>{selectedSession?.profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{selectedSession?.profile?.role}</p>
                </div>
              </DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold tracking-wider">
                Full shift breakdown including breaks and completed tasks.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Break History</h4>
                {selectedSession?.break_sessions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No breaks taken.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedSession?.break_sessions?.map(b => (
                      <div key={b.id} className="bg-muted/30 p-3 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold capitalize">{b.type.replace('_', ' ')}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {b.end_time 
                              ? `${differenceInMinutes(new Date(b.end_time), new Date(b.start_time))}m` 
                              : 'Active'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(b.start_time), 'HH:mm')} - {b.end_time ? format(new Date(b.end_time), 'HH:mm') : 'Now'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Assigned & Self Tasks</h4>
                {selectedSession?.all_tasks?.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No tasks recorded today.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedSession?.all_tasks?.map((t: any) => (
                      <div key={t.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 border border-border/50">
                        <CheckSquare className={`h-4 w-4 shrink-0 mt-0.5 ${t.is_completed ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <div className="flex flex-col">
                          <span className={cn("text-sm", t.is_completed ? "text-muted-foreground line-through" : "font-medium")}>
                            {t.title}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                            {t.type === 'assigned' ? 'Assigned to member' : 'Self task'} • {t.is_completed ? 'Done' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BDE Report Section injected here */}
            {bdeReport && (
              <div className="pt-4 border-t border-border/10">
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b border-indigo-100 pb-2 mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" /> BDE Daily Report Snapshot
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 space-y-1">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-indigo-400">Calls / Meetings</p>
                    <p className="text-sm font-black text-indigo-950">{bdeReport.total_calls_made} <span className="text-xs text-indigo-400 font-medium">/</span> {bdeReport.meetings_completed}</p>
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 space-y-1">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-indigo-400">Deals / Revenue</p>
                    <p className="text-sm font-black text-indigo-950">{bdeReport.deals_closed} <span className="text-xs text-indigo-400 font-medium">/</span> ₹{bdeReport.revenue_generated}</p>
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 space-y-1 sm:col-span-2">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-indigo-400">Lead Focus</p>
                    <p className="text-xs font-bold text-indigo-950 truncate">{bdeReport.lead_name || 'N/A'} <span className="text-indigo-400 font-medium">({bdeReport.lead_status || 'No status'})</span></p>
                  </div>
                </div>
                {(bdeReport.challenges_faced || bdeReport.next_day_plan) && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {bdeReport.challenges_faced && (
                      <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100/50 text-xs text-rose-900">
                        <span className="font-bold block mb-1">Challenges:</span> {bdeReport.challenges_faced}
                      </div>
                    )}
                    {bdeReport.next_day_plan && (
                      <div className="bg-sky-50/50 p-3 rounded-lg border border-sky-100/50 text-xs text-sky-900">
                        <span className="font-bold block mb-1">Next Plan:</span> {bdeReport.next_day_plan}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {selectedSession?.admin_note && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <h5 className="text-[10px] font-black uppercase text-amber-600 mb-1">Admin Note</h5>
                <p className="text-sm italic text-amber-800">"{selectedSession.admin_note}"</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Adjust Time Modal */}
        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Work Session</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold tracking-wider">
                Correct shift times or add an admin note for this session.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Shift Start Time</Label>
                <Input 
                  type="datetime-local" 
                  value={adjustData.start_time} 
                  onChange={(e) => setAdjustData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Shift End Time</Label>
                <Input 
                  type="datetime-local" 
                  value={adjustData.end_time} 
                  onChange={(e) => setAdjustData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason for Adjustment (Admin Note)</Label>
                <Textarea 
                  placeholder="Explain why this change was made..."
                  value={adjustData.admin_note}
                  onChange={(e) => setAdjustData(prev => ({ ...prev, admin_note: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjustTime}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  )
}
