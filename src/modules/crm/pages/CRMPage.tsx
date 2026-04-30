import { useState, useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { LeadList } from "../components/LeadList"
import { LeadForm } from "../components/LeadForm"
import { useCRMStore } from "../crmStore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { Contact as Lead } from "../types"

export default function CRMPage() {
  const { fetchLeads } = useCRMStore()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>()

  useEffect(() => {
    fetchLeads()
  }, [])

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedLead(undefined)
    setIsFormOpen(true)
  }

  return (
    <PageWrapper 
      title="CRM" 
      description="Manage your leads, pipeline, and customer relationships."
      actions={
        <Button className="gap-2" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      }
    >
      <div className="mt-6">
        <LeadList onEdit={handleEdit} />
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
    </PageWrapper>
  )
}
