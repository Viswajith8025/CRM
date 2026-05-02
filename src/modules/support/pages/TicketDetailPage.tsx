import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useSupportStore } from "../supportStore"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, AlertTriangle, CheckCircle2, MessageSquare, ShieldAlert } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { fetchTicketById, fetchMessages, messages, updateTicket, addMessage } = useSupportStore()
  
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState("")
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const ticketMessages = id ? messages[id] || [] : []

  const loadData = async () => {
    if (!id) return
    try {
      const data = await fetchTicketById(id)
      setTicket(data)
      await fetchMessages(id)
    } catch (err) {
      toast.error("Failed to load ticket")
      navigate('/support')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleEscalate = async () => {
    if (!ticket) return
    try {
      await updateTicket(ticket.id, { is_escalated: true, priority: 'urgent' })
      toast.success("Ticket escalated successfully")
      loadData()
    } catch (err) {
      toast.error("Failed to escalate ticket")
    }
  }

  const handleResolve = async () => {
    if (!ticket) return
    try {
      await updateTicket(ticket.id, { status: 'resolved' })
      toast.success("Ticket marked as resolved")
      loadData()
    } catch (err) {
      toast.error("Failed to resolve ticket")
    }
  }

  const handleSendReply = async () => {
    if (!reply.trim() || !ticket) return
    setIsSending(true)
    try {
      await addMessage({
        ticket_id: ticket.id,
        message: reply,
        is_internal_note: isInternalNote
      })
      setReply("")
      setIsInternalNote(false)
      toast.success("Reply added")
    } catch (err) {
      toast.error("Failed to add reply")
    } finally {
      setIsSending(false)
    }
  }

  if (loading) return <PageWrapper title="Loading ticket..."><div /></PageWrapper>
  if (!ticket) return <PageWrapper title="Ticket Not Found"><div /></PageWrapper>

  return (
    <PageWrapper 
      title={`Ticket #${ticket.id.split('-')[0]}`}
      description={ticket.subject}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/support')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {!ticket.is_escalated && ticket.status !== 'resolved' && (
            <Button variant="outline" className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 gap-2" onClick={handleEscalate}>
              <ShieldAlert className="h-4 w-4" /> Escalate
            </Button>
          )}
          {ticket.status !== 'resolved' && (
            <Button className="gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={handleResolve}>
              <CheckCircle2 className="h-4 w-4" /> Mark Resolved
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Thread */}
          <div className="rounded-xl border bg-card p-6 space-y-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {ticket.client?.name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{ticket.client?.name || 'Unknown Client'}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  <Badge variant="outline" className="uppercase text-[10px]">Original Request</Badge>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg text-sm leading-relaxed border">
                  {ticket.description}
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t">
              {ticketMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={msg.sender?.avatar_url} />
                    <AvatarFallback className={cn(
                      msg.sender_id === profile?.id ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {msg.sender?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{msg.sender?.full_name || 'System'}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                      {msg.is_internal_note && (
                        <Badge variant="secondary" className="uppercase text-[10px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Internal Note</Badge>
                      )}
                    </div>
                    <div className={cn(
                      "p-4 rounded-lg text-sm leading-relaxed border",
                      msg.is_internal_note ? "bg-amber-500/5 border-amber-500/20" : "bg-card"
                    )}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reply Box */}
          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center gap-4 border-b pb-4">
                <Button 
                  variant={!isInternalNote ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setIsInternalNote(false)}
                >
                  Public Reply
                </Button>
                <Button 
                  variant={isInternalNote ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setIsInternalNote(true)}
                  className={isInternalNote ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : ""}
                >
                  Internal Note
                </Button>
              </div>
              <Textarea 
                placeholder={isInternalNote ? "Write an internal note (clients won't see this)..." : "Write your reply to the client..."}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="min-h-[120px]"
              />
              <div className="flex justify-end">
                <Button onClick={handleSendReply} disabled={isSending || !reply.trim()} className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {isSending ? "Sending..." : isInternalNote ? "Add Note" : "Send Reply"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-2">Ticket Details</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge variant="outline" className={cn(
                  "uppercase",
                  ticket.status === 'resolved' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                  ticket.is_escalated && "bg-rose-500/10 text-rose-600 border-rose-500/20"
                )}>
                  {ticket.is_escalated ? 'Escalated' : ticket.status.replace('_', ' ')}
                </Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Priority</p>
                <Badge variant="secondary" className={cn(
                  "uppercase",
                  ticket.priority === 'urgent' && "bg-rose-500 text-white",
                  ticket.priority === 'high' && "bg-orange-500 text-white"
                )}>
                  {ticket.priority}
                </Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <span className="text-sm font-medium capitalize">{ticket.category.replace('_', ' ')}</span>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Assignee</p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={ticket.assignee?.avatar_url} />
                    <AvatarFallback>{ticket.assignee?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{ticket.assignee?.full_name || 'Unassigned'}</span>
                </div>
              </div>

              {ticket.sla_deadline && ticket.status !== 'resolved' && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> SLA Deadline
                  </p>
                  <p className="text-sm font-bold">
                    {format(new Date(ticket.sla_deadline), 'MMM d, h:mm a')}
                  </p>
                  {isPast(new Date(ticket.sla_deadline)) && (
                    <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> SLA Breached
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
