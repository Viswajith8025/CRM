import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useSupportStore } from "../supportStore"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { format, isPast, differenceInHours } from "date-fns"
import { cn } from "@/lib/utils"

export default function SupportDashboard() {
  const navigate = useNavigate()
  const { tickets, fetchTickets, isLoading } = useSupportStore()

  useEffect(() => {
    fetchTickets()
  }, [])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-rose-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-blue-500 text-white'
      case 'low': return 'bg-slate-500 text-white'
      default: return 'bg-slate-500 text-white'
    }
  }

  const getSlaStatus = (deadline: string | null, status: string) => {
    if (status === 'resolved' || status === 'closed') return null
    if (!deadline) return null
    
    const isBreached = isPast(new Date(deadline))
    const hoursLeft = differenceInHours(new Date(deadline), new Date())

    if (isBreached) {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 gap-1 text-[10px]">
          <AlertCircle className="h-3 w-3" /> SLA Breached
        </Badge>
      )
    }

    if (hoursLeft <= 12) {
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1 text-[10px]">
          <Clock className="h-3 w-3" /> {hoursLeft}h left
        </Badge>
      )
    }

    return null
  }

  return (
    <PageWrapper 
      title="Support Helpdesk" 
      description="Manage client support tickets and track SLA compliance."
      actions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      }
    >
      <div className="mt-6 rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Ticket ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">Loading tickets...</TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No active support tickets.</TableCell>
              </TableRow>
            ) : (
              tickets.map(ticket => (
                <TableRow 
                  key={ticket.id} 
                  className="group hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/support/tickets/${ticket.id}`)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{ticket.id.split('-')[0]}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold group-hover:text-primary transition-colors">{ticket.subject}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{ticket.category.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ticket.client?.name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px] uppercase", getPriorityColor(ticket.priority))}>
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase",
                      ticket.status === 'resolved' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                      ticket.is_escalated && "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    )}>
                      {ticket.is_escalated ? 'Escalated' : ticket.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getSlaStatus(ticket.sla_deadline, ticket.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  )
}
