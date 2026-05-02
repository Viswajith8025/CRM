import { PageWrapper } from "@/components/shared/PageWrapper"
import { ClientList } from "../components/ClientList"
import { ClientForm } from "../components/ClientForm"
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

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedClient(undefined)
    setIsFormOpen(true)
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
        <ClientList onEdit={handleEdit} />
      </div>

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
    </PageWrapper>
  )
}
