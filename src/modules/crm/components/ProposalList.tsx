import { useState, useEffect } from "react"
import { useCRMStore } from "../store/crmStore"
import type { Client, Proposal } from "../types"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { FileText, Eye, Loader2, Calendar } from "lucide-react"

interface ProposalListProps {
  client: Client
  onSelect: (proposal: Proposal) => void
}

export function ProposalList({ client, onSelect }: ProposalListProps) {
  const { proposals, fetchProposals, isLoading } = useCRMStore()
  
  useEffect(() => {
    fetchProposals()
  }, [])

  const clientProposals = proposals.filter(p => p.client_id === client.id || p.lead_id === client.lead_id)

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
            className="group flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/[0.02] transition-all cursor-pointer"
            onClick={() => onSelect(proposal)}
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{proposal.title}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    ₹{proposal.amount?.toLocaleString()}
                  </span>
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(proposal.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity gap-2">
              <Eye className="h-4 w-4" /> View
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
