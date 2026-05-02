import { useState, useEffect } from "react"
import { useCRMStore } from "../crmStore"
import type { Contact as Lead, Interaction } from "../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Plus, 
  FileText, 
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { useBillingStore } from "@/modules/billing/billingStore"
import { FileCheck } from "lucide-react"

interface LeadDetailsProps {
  lead: Lead
  onClose: () => void
}

export function LeadDetails({ lead, onClose }: LeadDetailsProps) {
  const { interactions, fetchInteractions, addInteraction } = useCRMStore()
  const [newInteraction, setNewInteraction] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const leadInteractions = interactions[lead.id] || []

  useEffect(() => {
    fetchInteractions(lead.id)
  }, [lead.id, fetchInteractions])

  const handleAddInteraction = async (type: Interaction['type']) => {
    if (!newInteraction.trim()) {
      toast.error("Please enter some details about the interaction")
      return
    }

    setIsSubmitting(true)
    try {
      await addInteraction({
        lead_id: lead.id,
        type,
        content: newInteraction.trim()
      })
      setNewInteraction("")
      toast.success(`Logged ${type} successfully`)
    } catch (error) {
      toast.error("Failed to log interaction")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h2>
          <p className="text-muted-foreground">{lead.company || "No Company Specified"}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-500">${lead.value?.toLocaleString() || "0"}</div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Estimated Value</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/30 p-3 rounded-lg border">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Score</p>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-black ${lead.score > 70 ? 'text-emerald-500' : lead.score > 30 ? 'text-amber-500' : 'text-rose-500'}`}>
              {lead.score}/100
            </span>
          </div>
        </div>
        <div className="bg-muted/30 p-3 rounded-lg border">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Segment</p>
          <p className="text-lg font-bold">{lead.segment}</p>
        </div>
        <div className="bg-muted/30 p-3 rounded-lg border">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Source</p>
          <p className="text-lg font-bold">{lead.source || "Unknown"}</p>
        </div>
      </div>

      <Tabs defaultValue="activity" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">Activity & Timeline</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activity" className="flex-1 flex flex-col space-y-4 pt-4 min-h-0">
          {/* Interaction Input */}
          <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-primary/10">
            <Textarea 
              placeholder="Log a call, email summary, or meeting notes..."
              className="min-h-[100px] bg-background/50 border-primary/10 focus-visible:ring-primary"
              value={newInteraction}
              onChange={(e) => setNewInteraction(e.target.value)}
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 gap-2 hover:bg-blue-500/10 hover:text-blue-500 border-blue-500/20"
                onClick={() => handleAddInteraction('call')}
                disabled={isSubmitting}
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 gap-2 hover:bg-emerald-500/10 hover:text-emerald-500 border-emerald-500/20"
                onClick={() => handleAddInteraction('whatsapp')}
                disabled={isSubmitting}
              >
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 gap-2 hover:bg-purple-500/10 hover:text-purple-500 border-purple-500/20"
                onClick={() => handleAddInteraction('email')}
                disabled={isSubmitting}
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 gap-2 hover:bg-indigo-500/10 hover:text-indigo-500 border-indigo-500/20"
                onClick={() => handleAddInteraction('meeting')}
                disabled={isSubmitting}
              >
                <Calendar className="h-3.5 w-3.5" /> Meeting
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
              {leadInteractions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic">
                  No interactions logged yet.
                </div>
              ) : (
                leadInteractions.map((interaction) => (
                  <div key={interaction.id} className="relative pl-10">
                    <div className="absolute left-0 top-0 h-9 w-9 rounded-full bg-background border-2 border-muted flex items-center justify-center z-10">
                      {interaction.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                      {interaction.type === 'whatsapp' && <MessageSquare className="h-4 w-4 text-emerald-500" />}
                      {interaction.type === 'email' && <Mail className="h-4 w-4 text-purple-500" />}
                      {interaction.type === 'meeting' && <Calendar className="h-4 w-4 text-indigo-500" />}
                    </div>
                    <div className="bg-muted/20 p-4 rounded-xl border border-muted/50">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                          {interaction.type} logged
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(interaction.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{interaction.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="proposals" className="flex-1 flex flex-col space-y-4 pt-4 min-h-0">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Lead Proposals</h3>
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New Proposal
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-4">
              {/* Demo Proposal for testing conversion */}
              <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">Digital Marketing Retainer</h4>
                    <p className="text-xs text-muted-foreground">Created on {format(new Date(), 'PP')}</p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">Draft</Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-muted">
                  <span className="text-lg font-black">${lead.value?.toLocaleString()}</span>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="gap-2"
                    onClick={async () => {
                      try {
                        const { clients, fetchClients } = useCRMStore.getState()
                        if (clients.length === 0) await fetchClients()
                        
                        // Find the actual client record linked to this lead
                        const realClient = useCRMStore.getState().clients.find(c => c.lead_id === lead.id)
                        
                        if (!realClient) {
                          toast.error("Please convert this lead to a Client (Closed Won) before creating an invoice.")
                          return
                        }

                        toast.info("Generating invoice from proposal...")
                        await useBillingStore.getState().addInvoice({
                          client_id: realClient.id,
                          amount: lead.value || 0,
                          status: 'sent',
                          invoice_number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
                          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        })
                        toast.success("Converted to Invoice successfully!")
                      } catch (err) {
                        toast.error("Failed to convert")
                      }
                    }}
                  >
                    <FileCheck className="h-3.5 w-3.5" /> Convert to Invoice
                  </Button>
                </div>
              </div>

              <div className="text-center py-6 opacity-30">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-[10px] uppercase font-bold tracking-widest">End of Proposals</p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer Info */}
      <div className="pt-4 border-t border-muted/50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-muted-foreground">Next Follow-up</span>
            <span className={`text-xs font-bold ${lead.next_follow_up ? 'text-orange-500' : 'text-muted-foreground italic'}`}>
              {lead.next_follow_up ? format(new Date(lead.next_follow_up), 'PPP') : "Not set"}
            </span>
          </div>
          {lead.last_contacted_at && (
            <div className="flex flex-col border-l border-muted/50 pl-4">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Last Contacted</span>
              <span className="text-xs font-bold text-muted-foreground">
                {format(new Date(lead.last_contacted_at), 'PPP')}
              </span>
            </div>
          )}
        </div>
        <Badge variant="outline" className="px-3 py-1 font-bold">
          {lead.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>
    </div>
  )
}
