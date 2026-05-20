import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { format, differenceInMinutes } from "date-fns"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Calendar as CalendarIcon, Filter, Search, UserCircle, Coffee, CheckSquare, ChevronDown } from "lucide-react"
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
import { Flag } from "lucide-react"

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
  daily_tasks: any[]
  is_flagged?: boolean
  admin_note?: string
}

export default function TeamTimesheetsPage() {
  const { profile } = useAuthStore()
  const [sessions, setSessions] = useState<TeamSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSession, setSelectedSession] = useState<TeamSession | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [adjustData, setAdjustData] = useState({ start_time: "", end_time: "", admin_note: "" })

  useEffect(() => {
    async function fetchTeamTimesheets() {
      if (!profile?.organization_id) return
      
      try {
        const { data, error } = await supabase
          .from('work_sessions')
          .select(`
            *,
            profile:profiles(full_name, avatar_url, role),
            break_sessions(*)
          `)
          .eq('organization_id', profile.organization_id)
          .order('start_time', { ascending: false })
          .limit(100)

        if (error) throw error

        // Fetch recent tasks for the org separately since there's no FK
        const { data: taskData } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('task_date', { ascending: false })
          .limit(500)

        const tasks = taskData || []
        
        const mappedSessions = (data as any || []).map((session: any) => {
          const sessionDate = session.start_time.split('T')[0]
          return {
            ...session,
            daily_tasks: tasks.filter(t => t.user_id === session.user_id && t.task_date === sessionDate)
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

  const filteredSessions = sessions.filter(s => 
    s.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <CalendarIcon className="h-4 w-4" /> Date Range
            </Button>
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4" /> Status
            </Button>
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
                    
                    const completedTasks = session.daily_tasks?.filter(t => t.is_completed).length || 0
                    const totalTasks = session.daily_tasks?.length || 0

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
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Completed Tasks</h4>
                {selectedSession?.daily_tasks?.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No tasks recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedSession?.daily_tasks?.map(t => (
                      <div key={t.id} className="flex items-start gap-3 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <CheckSquare className="h-4 w-4 text-emerald-500 mt-0.5" />
                        <span className={cn("text-sm", t.is_completed ? "text-muted-foreground" : "font-medium")}>
                          {t.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
