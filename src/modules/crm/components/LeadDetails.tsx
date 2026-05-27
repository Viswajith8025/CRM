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
import { useBillingStore } from "@/modules/billing"
import { FileCheck, Activity } from "lucide-react"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { ProposalList } from "./ProposalList"

interface LeadDetailsProps {
  lead: Lead
  onClose: () => void
  onEdit?: (lead: Lead) => void
}

export function LeadDetails({ lead, onClose, onEdit }: LeadDetailsProps) {
  const { interactions, fetchInteractions, addInteraction } = useCRMStore()
  const [newInteraction, setNewInteraction] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const leadInteractions = interactions[lead.id] || []
  
  // Create a virtual client object for ProposalList compatibility
  const virtualClient = {
    id: lead.id,
    name: `${lead.first_name} ${lead.last_name}`,
    lead_id: lead.id,
    email: lead.email,
    phone: lead.phone
  } as any

  useEffect(() => {
    fetchInteractions(lead.id)
  }, [lead.id, fetchInteractions])

  const handleAddInteraction = async (type: Interaction['type']) => {
    // 1. Perform dynamic external action
    if (type === 'call') {
      if (!lead.phone) return toast.error("No phone number available for this lead.")
      window.open(`tel:${lead.phone}`, '_self')
    } else if (type === 'email') {
      if (!lead.email) return toast.error("No email available for this lead.")
      window.open(`mailto:${lead.email}`, '_self')
    } else if (type === 'whatsapp') {
      if (!lead.phone) return toast.error("No phone number available for this lead.")
      const cleanPhone = lead.phone.replace(/[^0-9+]/g, '')
      window.open(`https://wa.me/${cleanPhone}`, '_blank')
    } else if (type === 'meeting') {
      window.open(`https://meet.google.com/new`, '_blank')
    }

    // 2. Log the interaction
    const content = newInteraction.trim() || `Initiated a ${type}`

    setIsSubmitting(true)
    try {
      await addInteraction({
        lead_id: lead.id,
        type,
        content
      })
      setNewInteraction("")
      toast.success(`Started ${type} and logged successfully`)
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
          <div className="flex items-center gap-2 justify-end mb-1">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(lead)} className="h-7 text-xs font-bold uppercase tracking-wider">
                Edit Lead
              </Button>
            )}
            <div className="text-2xl font-bold text-emerald-500">${lead.value?.toLocaleString() || "0"}</div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Estimated Value</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/30 p-3 rounded-lg border">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Source</p>
          <p className="text-lg font-bold">{lead.source || "Unknown"}</p>
        </div>
        {lead.requirement && (
          <div className="bg-sky-500/10 p-3 rounded-lg border border-sky-500/20">
            <p className="text-[10px] uppercase font-bold text-sky-600 mb-1">Service Requirement</p>
            <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">{lead.requirement}</p>
          </div>
        )}
      </div>



      <Tabs defaultValue="activity" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">Interactions</TabsTrigger>
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
          </div>
          
          <ProposalList 
            client={virtualClient} 
          />
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
