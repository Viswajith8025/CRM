import { PageWrapper } from "@/components/shared/PageWrapper"
import { ClientList } from "../components/ClientList"
import { ClientForm } from "../components/ClientForm"
import { ProposalForm } from "../components/ProposalForm"
import { ProposalList } from "../components/ProposalList"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet } from "lucide-react"
import { ImportWizard } from "@/components/shared/ImportWizard"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { Client } from "../types"

export default function ClientsPage() {
  const navigate = useNavigate()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | undefined>()
  const [isProposalOpen, setIsProposalOpen] = useState(false)
  const [isListOpen, setIsListOpen] = useState(false)
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
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5" onClick={() => setIsImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Bulk Import
            </Button>
            <Button className="gap-2 font-bold" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </div>
        }
      >
        <ImportWizard 
          module="clients" 
          open={isImportOpen} 
          onOpenChange={setIsImportOpen} 
          onComplete={() => {
            // Trigger refresh logic if needed
          }} 
        />
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
            onSuccess={(proposal) => {
              setIsProposalOpen(false)
              setEditingProposal(null)
              navigate(`/proposals/${proposal.id}`)
            }} 
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
              onEdit={handleEditProposal}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
