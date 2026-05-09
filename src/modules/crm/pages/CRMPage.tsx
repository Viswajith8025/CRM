import { useState, useEffect } from "react" // Force refresh
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { LeadList } from "../components/LeadList"
import { LeadForm } from "../components/LeadForm"
import { useCRMStore } from "../crmStore"
import { Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Contact as Lead, Client } from "../types"
import { LeadDetails } from "../components/LeadDetails"

import { LayoutGrid, List, FileSpreadsheet } from "lucide-react"
import { LeadKanban } from "../components/LeadKanban"
import { ImportWizard } from "@/components/shared/ImportWizard"

export default function CRMPage() {
  const { fetchLeads } = useCRMStore()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>()
  const [detailedLead, setDetailedLead] = useState<Lead | undefined>()
  const [view, setView] = useState<'list' | 'kanban'>('kanban')

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead)
    setIsFormOpen(true)
  }

  const handleViewDetails = (lead: Lead) => {
    setDetailedLead(lead)
    setIsDetailsOpen(true)
  }

  const handleAddLead = () => {
    setSelectedLead(undefined)
    setIsFormOpen(true)
  }

  return (
    <PageWrapper 
      title="Lead Management" 
      description="Manage your pipeline, and customer relationships with drag-and-drop simplicity."
      actions={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button 
              variant={view === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={view === 'kanban' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('kanban')}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5" onClick={() => setIsImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            Bulk Import
          </Button>
          <Button className="gap-2 font-bold" onClick={handleAddLead}>
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      }
    >
      <ImportWizard 
        module="leads" 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onComplete={() => fetchLeads()} 
      />
      <div className="mt-6">
        {view === 'list' ? (
          <LeadList onEdit={handleEditLead} onViewDetails={handleViewDetails} />
        ) : (
          <LeadKanban />
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            <DialogDescription>
              {selectedLead ? "Update the information for this lead." : "Fill in the details to add a new lead to your CRM."}
            </DialogDescription>
          </DialogHeader>
          <LeadForm 
            lead={selectedLead} 
            onSuccess={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="sm:max-w-[600px] w-full">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-muted-foreground uppercase tracking-[0.2em] text-[10px] font-black">Lead Details & History</SheetTitle>
          </SheetHeader>
          {detailedLead && (
            <LeadDetails 
              lead={detailedLead} 
              onClose={() => setIsDetailsOpen(false)} 
            />
          )}
        </SheetContent>
      </Sheet>
    </PageWrapper>
  )
}
