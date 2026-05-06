import { PageWrapper } from "@/components/shared/PageWrapper"
import { ClientList } from "../components/ClientList"
import { ClientForm } from "../components/ClientForm"
import { ProposalForm } from "../components/ProposalForm"
import { ProposalPreview } from "../components/ProposalPreview"
import { ProposalList } from "../components/ProposalList"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { Client } from "../types"

export default function ClientsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | undefined>()
  
  const [isProposalOpen, setIsProposalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(false)
  const [proposalData, setProposalData] = useState<any>(null)
  const [editingProposal, setEditingProposal] = useState<any>(null)

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedClient(undefined)
    setIsFormOpen(true)
  }

  const handleCreateProposal = (client: Client) => {
    setSelectedClient(client)
    setIsProposalOpen(true)
  }

  const handleViewProposals = (client: Client) => {
    setSelectedClient(client)
    setIsListOpen(true)
  }

  const handleEditProposal = (proposal: any) => {
    setEditingProposal(proposal)
    setIsListOpen(false)
    setIsProposalOpen(true)
  }

  return (
    <PageWrapper 
      title="Active Clients" 
      description="Manage your active customer relationships and contracts."
      actions={
        <Button className="gap-2 font-bold" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      }
    >
      <div className="mt-6">
        <ClientList 
          onEdit={handleEdit} 
          onCreateProposal={handleCreateProposal} 
          onViewProposals={handleViewProposals}
        />
      </div>

      {/* CLIENT FORM DIALOG */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedClient ? "Edit Client" : "Add New Client"}</DialogTitle>
            <DialogDescription>
              {selectedClient ? "Update the information for this active client." : "Fill in the details to add a new active client."}
            </DialogDescription>
          </DialogHeader>
          <ClientForm 
            client={selectedClient} 
            onSuccess={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* PROPOSAL FORM DIALOG */}
      <Dialog open={isProposalOpen} onOpenChange={(open) => { setIsProposalOpen(open); if (!open) setEditingProposal(null) }}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{editingProposal ? "Edit Proposal" : "Create Project Proposal"}</DialogTitle>
            <DialogDescription>
              {editingProposal
                ? `Update the proposal "${editingProposal.title}".`
                : `Draft a professional proposal for ${selectedClient?.name}. The template will be generated automatically.`
              }
            </DialogDescription>
          </DialogHeader>
          <ProposalForm 
            client={selectedClient}
            proposal={editingProposal}
            onSuccess={(data) => {
              setProposalData(data)
              setIsProposalOpen(false)
              setEditingProposal(null)
              setIsPreviewOpen(true)
            }} 
          />
        </DialogContent>
      </Dialog>

      {/* PROPOSAL PREVIEW DIALOG */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[850px] p-0 overflow-hidden h-[90vh] flex flex-col gap-0 border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Proposal Preview</DialogTitle>
            <DialogDescription>
              A professional preview of the generated project proposal.
            </DialogDescription>
          </DialogHeader>
          <ProposalPreview 
            data={proposalData} 
            onClose={() => setIsPreviewOpen(false)} 
          />
        </DialogContent>
      </Dialog>
      {/* PROPOSAL LIST DIALOG */}
      <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Saved Proposals</DialogTitle>
            <DialogDescription>
              Previously generated project proposals for {selectedClient?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <ProposalList 
              client={selectedClient} 
              onSelect={(proposal) => {
                setProposalData(proposal.content)
                setIsListOpen(false)
                setIsPreviewOpen(true)
              }}
              onEdit={handleEditProposal}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
