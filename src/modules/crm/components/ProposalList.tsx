import { useState, useEffect } from "react"
import { useCRMStore } from "../store/crmStore"
import type { Client, Proposal } from "../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { FileText, Eye, Loader2, Calendar, Pencil } from "lucide-react"

interface ProposalListProps {
  client: Client
  onSelect: (proposal: Proposal) => void
  onEdit?: (proposal: Proposal) => void
}

export function ProposalList({ client, onSelect, onEdit }: ProposalListProps) {
  const { proposals, fetchProposals, isLoading } = useCRMStore()
  
  useEffect(() => {
    fetchProposals()
  }, [])

  const clientProposals = proposals.filter(p => p.client_id === client.id || p.lead_id === client.lead_id)

  const statusColor: Record<string, string> = {
    draft:    "bg-amber-500/10 text-amber-600 border-amber-500/20",
    sent:     "bg-blue-500/10 text-blue-600 border-blue-500/20",
    accepted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Fetching client proposals...</p>
      </div>
    )
  }

  if (clientProposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/5">
        <FileText className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <h3 className="font-bold text-lg">No Proposals Found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
          There are no proposals saved for {client.name} yet.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-3">
        {clientProposals.map((proposal) => (
          <div 
            key={proposal.id} 
            className="group flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/[0.02] transition-all"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{proposal.title}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    ₹{proposal.amount?.toLocaleString()}
                  </span>
                  <Badge variant="outline" className={`text-[9px] font-bold h-4 px-1.5 border ${statusColor[proposal.status] || ""}`}>
                    {proposal.status.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(proposal.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-8 text-xs"
                  onClick={(e) => { e.stopPropagation(); onEdit(proposal) }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 h-8 text-xs"
                onClick={() => onSelect(proposal)}
              >
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
