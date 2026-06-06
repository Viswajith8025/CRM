import { useEffect, useState, useMemo } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { usePermissions } from "@/hooks/usePermissions"
import { format, differenceInDays } from "date-fns"
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  UserCircle,
  Calendar,
  Filter,
  Search,
  Check,
  X,
  History,
  Clock,
  CheckSquare
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AttendanceLeave } from "../components/AttendanceLeave"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface LeaveRequest {
  id: string
  user_id: string
  organization_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  is_emergency: boolean
  created_at: string
  profile: {
    full_name: string
    avatar_url: string
    role: string
  }
  leave_type: {
    name: string
    color: string
  }
  actions?: {
    id: string
    action: string
    note: string | null
    created_at: string
    actor?: {
      full_name: string
    }
  }[]
}

export default function LeaveApprovalsPage() {
  const { profile } = useAuthStore()
  const { hasPermission } = usePermissions()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [isActionOpen, setIsActionOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [actionNote, setActionNote] = useState("")

  useEffect(() => {
    fetchRequests()

    if (!profile?.organization_id) return

    const channel = supabase
      .channel('leave_approvals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
          filter: `organization_id=eq.${profile.organization_id}`
        },
        () => {
          fetchRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.organization_id])

  async function fetchRequests() {
    if (!profile?.organization_id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          user:profiles!user_id(full_name, avatar_url, role),
          leave_type:leave_types(name, color),
          actions:leave_request_actions(
            id,
            action,
            note,
            created_at,
            actor:profiles!actor_id(full_name)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      // Normalise: map 'user' to 'profile' for template compatibility
      const normalised = (data || []).map((r: any) => ({ ...r, profile: r.user }))
      setRequests(normalised)
    } catch (err) {
      console.error("Failed to fetch approvals:", err)
      toast.error("Failed to load leave requests")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedRequest) return
    
    // 1. Prevent self-approval
    if (selectedRequest.user_id === profile?.id) {
      toast.error("You cannot approve or reject your own leave request.")
      return
    }

    // 2. Enforce Hierarchy/Role via dynamic permissions
    const isAuthorized = profile?.role === 'super_admin' || hasPermission('hr.manage_leave') || hasPermission('hr.manage_attendance')
    if (!isAuthorized) {
      toast.error("You do not have sufficient HR authorization to process leave requests.")
      return
    }

    // 3. Mandatory Rejection Note
    if (actionType === 'reject' && !actionNote.trim()) {
      toast.error("Enterprise compliance requires a mandatory note when rejecting a leave request.")
      return
    }

    const newStatus = actionType === 'approve' ? 'approved' : 'rejected'

    try {
      // 1. Update request status
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({ 
          status: newStatus,
          current_approver_id: profile?.id
        })
        .eq('id', selectedRequest.id)

      if (updateError) throw updateError

      // 2. Log action in history
      await supabase
        .from('leave_request_actions')
        .insert([{
          leave_request_id: selectedRequest.id,
          actor_id: profile?.id,
          action: actionType,
          note: actionNote
        }])

      toast.success(`Request ${newStatus} successfully`)
      setIsActionOpen(false)
      setActionNote("")
      fetchRequests()
    } catch (err) {
      toast.error("Failed to process request")
    }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(req => 
      req.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.leave_type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [requests, searchTerm])

  const pendingRequests = useMemo(() => filteredRequests.filter(r => r.status === 'pending'), [filteredRequests])
  const processedRequests = useMemo(() => filteredRequests.filter(r => r.status !== 'pending'), [filteredRequests])

  // Calculate dynamic statistics
  const stats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    
    let approvedToday = 0
    let teamOnLeave = 0
    let emergencyPending = 0

    requests.forEach(r => {
      // 1. Team on leave today
      if (r.status === 'approved' && todayStr >= r.start_date && todayStr <= r.end_date) {
        teamOnLeave++
      }
      
      // 2. Approved Today (checking action logs)
      if (r.status === 'approved') {
        const approveAction = r.actions?.find(a => a.action === 'approve')
        if (approveAction && approveAction.created_at.startsWith(todayStr)) {
          approvedToday++
        } else if (!approveAction && r.created_at.startsWith(todayStr)) {
           // Fallback for legacy records without action logs
           approvedToday++
        }
      }

      // 3. Emergency Pending
      if (r.is_emergency && r.status === 'pending') {
        emergencyPending++
      }
    })

    return { approvedToday, teamOnLeave, emergencyPending }
  }, [requests])

  return (
    <PageWrapper 
      title="Leave Approvals" 
      description="Review and process team leave requests with full audit trail."
    >
      <Tabs defaultValue="approvals" className="mt-6">
        <TabsList className="grid grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="approvals" className="gap-2 text-xs">
            <CheckSquare className="h-3.5 w-3.5" /> Leave Approvals
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 text-xs">
            <Clock className="h-3.5 w-3.5" /> Time & Attendance
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="approvals" className="m-0 space-y-8">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Pending</p>
                <p className="text-xl font-black">{pendingRequests.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Approved Today</p>
                <p className="text-xl font-black">{stats.approvedToday}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Emergency</p>
                <p className="text-xl font-black">{stats.emergencyPending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Team on Leave</p>
                <p className="text-xl font-black">{stats.teamOnLeave}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-4 bg-card/40 p-4 rounded-2xl border border-border/40 backdrop-blur-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by employee or leave type..." 
              className="pl-9 bg-background/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="rounded-xl"><Filter className="h-4 w-4" /></Button>
        </div>

        {/* Pending Requests Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-amber-500" /> Action Required
            </h4>
            <Badge variant="outline" className="text-[10px] font-bold">{pendingRequests.length} Pending</Badge>
          </div>

          <div className="grid gap-4">
            {pendingRequests.length === 0 ? (
              <div className="py-12 text-center bg-card/20 border border-dashed rounded-2xl">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500/20 mb-2" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Inbox Zero! No pending leaves.</p>
              </div>
            ) : (
              pendingRequests.map(req => {
                const days = differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1
                return (
                  <Card key={req.id} className={cn(
                    "bg-card/40 border-border/40 hover:border-primary/50 transition-all backdrop-blur-md relative overflow-hidden",
                    req.is_emergency && "border-rose-200 bg-rose-50/20"
                  )}>
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center">
                        {/* Employee Column */}
                        <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-border/10">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 ring-2 ring-background ring-offset-2 ring-offset-border/10">
                              <AvatarImage src={req.profile?.avatar_url} />
                              <AvatarFallback><UserCircle className="h-6 w-6" /></AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-black text-sm uppercase tracking-tight">{req.profile?.full_name}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{req.profile?.role}</p>
                            </div>
                          </div>
                        </div>

                        {/* Leave Detail Column */}
                        <div className="p-6 flex-1 flex flex-col md:flex-row md:items-center gap-6">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-black uppercase text-[10px]" style={{ color: req.leave_type?.color, borderColor: req.leave_type?.color + '40' }}>
                                {req.leave_type?.name}
                              </Badge>
                              <span className="text-xs font-bold text-muted-foreground">
                                {format(new Date(req.start_date), 'MMM d')} - {format(new Date(req.end_date), 'MMM d, yyyy')}
                              </span>
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black">{days} Days</Badge>
                            </div>
                            <p className="text-xs text-foreground italic font-medium leading-relaxed">
                              "{req.reason}"
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="rounded-xl hover:bg-rose-50 hover:text-rose-600 border-rose-100"
                              onClick={() => {
                                setSelectedRequest(req)
                                setActionType('reject')
                                setIsActionOpen(true)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button 
                              className="rounded-xl gap-2 h-10 px-6 font-black uppercase text-xs"
                              onClick={() => {
                                setSelectedRequest(req)
                                setActionType('approve')
                                setIsActionOpen(true)
                              }}
                            >
                              <Check className="h-4 w-4" /> Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>

        {/* History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <History className="h-3 w-3" /> Processed History
            </h4>
          </div>
          
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardContent className="p-0">
              <div className="divide-y divide-border/10">
                {processedRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground uppercase font-bold">No processed requests yet</div>
                ) : (
                  processedRequests.map(req => (
                    <div key={req.id} className="p-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={req.profile?.avatar_url} />
                            <AvatarFallback><UserCircle className="h-4 w-4" /></AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-bold">{req.profile?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{req.leave_type?.name} • {format(new Date(req.start_date), 'MMM d')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">{format(new Date(req.created_at), 'MMM d, h:mm a')}</span>
                          {req.status === 'approved' ? (
                            <Badge className="bg-emerald-500 uppercase text-[8px]">Approved</Badge>
                          ) : req.status === 'cancelled' ? (
                            <Badge variant="outline" className="uppercase text-[8px]">Cancelled</Badge>
                          ) : (
                            <Badge variant="destructive" className="uppercase text-[8px]">Rejected</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Dialog */}
        <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="uppercase font-black tracking-widest">
                {actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Confirm your decision and add optional feedback for the leave request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Employee</p>
                <p className="font-black text-sm uppercase">{selectedRequest?.profile?.full_name}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{selectedRequest?.leave_type?.name}</Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {selectedRequest && differenceInDays(new Date(selectedRequest.end_date), new Date(selectedRequest.start_date)) + 1} Days
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-black tracking-widest">Notes / Feedback</Label>
                <Textarea 
                  placeholder={
                    actionType === 'reject' ? "Please provide a reason for rejection..." :
                    "Add an internal note or message to the employee..."
                  }
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActionOpen(false)} className="rounded-xl uppercase font-black text-xs">Cancel</Button>
              <Button 
                className={cn(
                  "rounded-xl uppercase font-black text-xs",
                  actionType === 'reject' ? "bg-rose-600 hover:bg-rose-700" : ""
                )}
                onClick={handleAction}
              >
                Confirm {actionType}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </TabsContent>

        <TabsContent value="attendance" className="m-0">
          <AttendanceLeave />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  )
}
