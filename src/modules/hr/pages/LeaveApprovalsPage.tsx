import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { format, differenceInDays } from "date-fns"
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  UserCircle,
  Calendar,
  Filter,
  Search,
  MessageSquare,
  Check,
  X,
  History,
  Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'clarification_required'
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
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [isActionOpen, setIsActionOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'clarification'>('approve')
  const [actionNote, setActionNote] = useState("")

  useEffect(() => {
    fetchRequests()
  }, [profile?.organization_id])

  async function fetchRequests() {
    if (!profile?.organization_id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          user:profiles!leave_requests_user_id_fkey(full_name, avatar_url, role),
          leave_type:leave_types!leave_requests_leave_type_id_fkey(name, color),
          actions:leave_request_actions(
            id,
            action,
            note,
            created_at,
            actor:profiles!leave_request_actions_actor_id_fkey(full_name)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

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
    
    const newStatus = actionType === 'approve' ? 'approved' : 
                     actionType === 'reject' ? 'rejected' : 
                     'clarification_required'

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

  const filteredRequests = requests.filter(req => 
    req.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.leave_type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pendingRequests = filteredRequests.filter(r => r.status === 'pending')
  const processedRequests = filteredRequests.filter(r => r.status !== 'pending')

  // Calculate dynamic active leaves (approved requests overlapping with today's date)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const activeLeavesCount = requests.filter(r => 
    r.status === 'approved' && 
    todayStr >= r.start_date && 
    todayStr <= r.end_date
  ).length

  return (
    <PageWrapper 
      title="Leave Approvals" 
      description="Review and process team leave requests with full audit trail."
    >
      <div className="space-y-8">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Pending</p>
                <p className="text-xl font-black">{requests.filter(r => r.status === 'pending').length}</p>
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
                <p className="text-xl font-black">{requests.filter(r => r.status === 'approved').length}</p>
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
                <p className="text-xl font-black">{requests.filter(r => r.is_emergency && r.status === 'pending').length}</p>
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
                <p className="text-xl font-black">{activeLeavesCount}</p>
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
                              variant="outline" 
                              size="icon" 
                              className="rounded-xl hover:bg-blue-50 hover:text-blue-600 border-blue-100"
                              onClick={() => {
                                setSelectedRequest(req)
                                setActionType('clarification')
                                setIsActionOpen(true)
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
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
                          ) : req.status === 'clarification_required' ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 uppercase text-[8px]">Needs Info</Badge>
                          ) : req.status === 'cancelled' ? (
                            <Badge variant="outline" className="uppercase text-[8px]">Cancelled</Badge>
                          ) : (
                            <Badge variant="destructive" className="uppercase text-[8px]">Rejected</Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Render clarification audit note log if present */}
                      {req.status === 'clarification_required' && req.actions && req.actions.length > 0 && (
                        <div className="ml-12 p-3 bg-blue-500/10 dark:bg-blue-500/5 rounded-xl border border-blue-500/20">
                          <p className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Clarification Request note:</p>
                          <p className="text-xs italic text-foreground mt-1">
                            "{req.actions.find(a => a.action === 'clarification')?.note || 'Please specify details.'}"
                          </p>
                        </div>
                      )}
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
                {actionType === 'approve' ? 'Approve Request' : 
                 actionType === 'reject' ? 'Reject Request' : 
                 'Request Clarification'}
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
                    actionType === 'clarification' ? "What specific information do you need?" :
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
                  actionType === 'reject' ? "bg-rose-600 hover:bg-rose-700" :
                  actionType === 'clarification' ? "bg-blue-600 hover:bg-blue-700" : ""
                )}
                onClick={handleAction}
              >
                Confirm {actionType}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  )
}
