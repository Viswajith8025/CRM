import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { format, differenceInDays } from "date-fns"
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText,
  Trash2,
  Info,
  BookOpen
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface LeaveType {
  id: string
  name: string
  icon: string
  color: string
  description?: string
  policies?: {
    yearly_limit: number
    approval_required: boolean
  }[]
}

interface LeaveRequest {
  id: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'clarification_required'
  is_emergency: boolean
  leave_type: LeaveType
  created_at: string
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

export default function LeaveRequestsPage() {
  const { profile } = useAuthStore()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null)
  
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    is_emergency: false
  })

  useEffect(() => {
    fetchData()
  }, [profile?.organization_id])

  async function fetchData() {
    if (!profile?.organization_id) return
    setIsLoading(true)
    try {
      // Fetch leave types
      const { data: types } = await supabase
        .from('leave_types')
        .select('*, policies:leave_policies(yearly_limit, approval_required)')
        .eq('is_active', true)
      
      setLeaveTypes((types || []).filter(t => t.name !== 'Casual Leave' && t.name !== 'casual' && t.name !== 'Casual'))

      // Fetch balances for the current year
      const currentYear = new Date().getFullYear()
      const { data: bals } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', profile.id)
        .eq('year', currentYear)
        
      setBalances(bals || [])

      // Fetch requests along with active log actions for clarification notes
      const { data: reqs, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_type:leave_types(*),
          actions:leave_request_actions(
            id,
            action,
            note,
            created_at,
            actor:profiles!leave_request_actions_actor_id_fkey(full_name)
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(reqs || [])
    } catch (err) {
      console.error("Failed to fetch leave data:", err)
      toast.error("Failed to load leave history")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      if (editingRequest) {
        // 1. Update the existing leave request back to pending
        const { error: updateError } = await supabase
          .from('leave_requests')
          .update({
            leave_type_id: formData.leave_type_id,
            start_date: formData.start_date,
            end_date: formData.end_date,
            reason: formData.reason,
            is_emergency: formData.is_emergency,
            status: 'pending'
          })
          .eq('id', editingRequest.id)

        if (updateError) throw updateError

        // 2. Log resubmission action for full transparency
        await supabase
          .from('leave_request_actions')
          .insert([{
            leave_request_id: editingRequest.id,
            actor_id: profile?.id,
            action: 'resubmit',
            note: 'Employee updated details and resubmitted for approval.'
          }])

        toast.success("Leave request updated and resubmitted successfully")
      } else {
        // Use RPC to bypass PostgREST schema cache issues
        const { data: rpcData, error } = await supabase.rpc('submit_leave_request', {
          p_leave_type_id: formData.leave_type_id,
          p_start_date: formData.start_date,
          p_end_date: formData.end_date,
          p_reason: formData.reason,
          p_is_emergency: formData.is_emergency
        })
        
        if (error) throw error
        toast.success("Leave request submitted successfully")
      }
      
      setIsFormOpen(false)
      setEditingRequest(null)
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '', is_emergency: false })
      fetchData()
    } catch (err) {
      toast.error(editingRequest ? "Failed to resubmit request" : "Failed to submit request")
    }
  }

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('user_id', profile?.id) // Safety check

      if (error) throw error
      
      toast.success("Request cancelled")
      fetchData()
    } catch (err) {
      toast.error("Failed to cancel request")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-emerald-500 hover:bg-emerald-600 font-black uppercase text-[10px]">Approved</Badge>
      case 'rejected': return <Badge variant="destructive" className="font-black uppercase text-[10px]">Rejected</Badge>
      case 'pending': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-black uppercase text-[10px]">Pending</Badge>
      case 'clarification_required': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-black uppercase text-[10px]">Needs Info</Badge>
      default: return <Badge variant="outline" className="font-black uppercase text-[10px]">{status}</Badge>
    }
  }

  return (
    <PageWrapper 
      title="Leave Requests" 
      description="Manage your time off, track approvals, and view leave balances."
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-card/40 p-6 rounded-2xl border border-border/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-widest text-sm">Submit New Request</h3>
              <p className="text-xs text-muted-foreground uppercase font-medium">Plan your time off in advance.</p>
            </div>
          </div>
          
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl h-12 px-6 font-black uppercase tracking-widest text-xs">
                <Plus className="h-4 w-4" /> Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="uppercase font-black tracking-widest">
                  {editingRequest ? "Update & Resubmit Leave" : "Apply for Leave"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Fill out the form below to apply for a leave request, including start and end dates and reason.
                </DialogDescription>
              </DialogHeader>
              
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Leave Policy Overview</h4>
                <ul className="text-xs text-foreground space-y-1.5 font-medium leading-relaxed">
                  <li><strong className="text-primary">Paid Leave:</strong> Requires 2 days prior notice.</li>
                  <li><strong className="text-primary">Sick Leave:</strong> Exceeding 2 days requires a medical certificate upon return.</li>
                  <li><strong className="text-primary">Unpaid Leave:</strong> Subject to management approval based on current workload.</li>
                </ul>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="uppercase text-[10px] font-black tracking-widest">Leave Type</Label>
                    {formData.leave_type_id && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-[10px] font-bold uppercase text-primary gap-1">
                            <Info className="h-3 w-3" /> View Policy
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="uppercase font-black tracking-widest flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-primary" />
                              {leaveTypes.find(t => t.id === formData.leave_type_id)?.name} Policy
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                              View policies and carry forward options for the selected leave type.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                              <p className="text-xs font-bold text-primary uppercase mb-1 tracking-tight">Description</p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {leaveTypes.find(t => t.id === formData.leave_type_id)?.description || "No description available for this leave type."}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Yearly Limit</p>
                                <p className="text-xl font-black">{leaveTypes.find(t => t.id === formData.leave_type_id)?.policies?.[0]?.yearly_limit || '0'} Days</p>
                              </div>
                              <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Used</p>
                                <p className="text-xl font-black">{balances.find(b => b.leave_type_id === formData.leave_type_id)?.used || '0'} Days</p>
                              </div>
                              <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Pending</p>
                                <p className="text-xl font-black">{balances.find(b => b.leave_type_id === formData.leave_type_id)?.pending || '0'} Days</p>
                              </div>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-xl border border-border/50 mt-4">
                              <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Approval</p>
                              <p className="text-sm font-bold uppercase">{leaveTypes.find(t => t.id === formData.leave_type_id)?.policies?.[0]?.approval_required ? 'Required' : 'Automatic'}</p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  <Select onValueChange={(val) => setFormData(prev => ({ ...prev, leave_type_id: val }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 flex flex-col">
                    <Label className="uppercase text-[10px] font-black tracking-widest">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal h-10",
                            !formData.start_date && "text-muted-foreground"
                          )}
                        >
                          {formData.start_date ? (
                            format(new Date(formData.start_date), "dd/MM/yyyy")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.start_date ? new Date(formData.start_date) : undefined}
                          onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                          disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Label className="uppercase text-[10px] font-black tracking-widest">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal h-10",
                            !formData.end_date && "text-muted-foreground"
                          )}
                        >
                          {formData.end_date ? (
                            format(new Date(formData.end_date), "dd/MM/yyyy")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.end_date ? new Date(formData.end_date) : undefined}
                          onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                          disabled={(date) => {
                            const minDate = formData.start_date ? new Date(formData.start_date) : new Date(new Date().setHours(0,0,0,0));
                            return date < minDate;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="uppercase text-[10px] font-black tracking-widest">Reason for Leave</Label>
                  <Textarea 
                    placeholder="Describe why you need time off..."
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <input 
                    type="checkbox" 
                    id="emergency" 
                    className="h-4 w-4 accent-rose-500"
                    checked={formData.is_emergency}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_emergency: e.target.checked }))}
                  />
                  <Label htmlFor="emergency" className="text-xs font-bold text-rose-700 uppercase cursor-pointer">
                    This is an Emergency Leave
                  </Label>
                </div>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsFormOpen(false)
                  setEditingRequest(null)
                  setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '', is_emergency: false })
                }} className="rounded-xl font-bold uppercase text-xs">Cancel</Button>
                <Button onClick={handleSubmit} className="rounded-xl font-bold uppercase text-xs">
                  {editingRequest ? "Update & Resubmit" : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Request History */}
        <div className="grid gap-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
            <Clock className="h-3 w-3" /> Leave History
          </h4>
          
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground uppercase font-black tracking-widest text-xs">Loading history...</div>
          ) : requests.length === 0 ? (
            <Card className="bg-card/40 border-border/40 p-12 text-center">
              <CalendarIcon className="h-12 w-12 mx-auto opacity-10 mb-4" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No leave requests found</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map(req => {
                const days = differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1
                return (
                  <Card key={req.id} className="bg-card/40 border-border/40 hover:border-primary/50 transition-all backdrop-blur-md group relative overflow-hidden">
                    {req.is_emergency && (
                      <div className="absolute top-0 right-0 p-2">
                        <Badge className="bg-rose-500 font-black uppercase text-[8px] animate-pulse">Emergency</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className={cn("p-2 rounded-lg bg-primary/10")}>
                          <CalendarIcon className="h-4 w-4 text-primary" />
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      <CardTitle className="text-sm font-black uppercase tracking-tight">
                        {req.leave_type?.name}
                      </CardTitle>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        {format(new Date(req.start_date), 'MMM d')} - {format(new Date(req.end_date), 'MMM d, yyyy')}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-y border-border/10">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Duration</span>
                        <span className="text-sm font-bold">{days} {days === 1 ? 'Day' : 'Days'}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Reason</span>
                        <p className="text-xs text-foreground line-clamp-2 italic font-medium leading-relaxed">
                          "{req.reason}"
                        </p>
                      </div>

                      {/* Dynamic Clarification Action / Note Log block */}
                      {req.status === 'clarification_required' && req.actions && req.actions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-500/10 dark:bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-1">
                          <p className="text-[10px] font-black uppercase text-blue-500 tracking-wider flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" /> Clarification Required
                          </p>
                          <p className="text-xs text-foreground italic font-medium leading-relaxed">
                            "{req.actions.find(a => a.action === 'clarification')?.note || 'Please update your request details.'}"
                          </p>
                        </div>
                      )}

                      {req.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase text-[10px] h-8 mt-2"
                          onClick={() => handleCancel(req.id)}
                        >
                          Cancel Request
                        </Button>
                      )}

                      {req.status === 'clarification_required' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 hover:text-blue-600 font-black uppercase text-[10px] h-8 mt-2 transition-all duration-300"
                          onClick={() => {
                            setEditingRequest(req)
                            setFormData({
                              leave_type_id: req.leave_type.id,
                              start_date: req.start_date,
                              end_date: req.end_date,
                              reason: req.reason,
                              is_emergency: req.is_emergency
                            })
                            setIsFormOpen(true)
                          }}
                        >
                          Update & Resubmit
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
