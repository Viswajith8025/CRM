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
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Contact as Lead } from "../types"

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
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Leads</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          <LeadList onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="pipeline">
          <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            Kanban Pipeline View coming soon
          </div>
        </TabsContent>
        <TabsContent value="reminders">
          <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            Follow-up Reminders coming soon
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
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
