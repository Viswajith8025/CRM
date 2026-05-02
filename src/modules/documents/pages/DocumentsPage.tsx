import { useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { DocumentList } from "../components/DocumentList"
import { DocumentUploadModal } from "../components/DocumentUploadModal"
import { Button } from "@/components/ui/button"
import { Plus, FolderUp } from "lucide-react"

export default function DocumentsPage() {
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  return (
    <PageWrapper 
      title="Document Management" 
      description="Securely store, version, and share proposals, contracts, and project assets."
      actions={
        <Button className="gap-2" onClick={() => setIsUploadOpen(true)}>
          <Plus className="h-4 w-4" />
          <FolderUp className="h-4 w-4" />
          Upload Document
        </Button>
      }
    >
      <div className="mt-6">
        <DocumentList />
      </div>

      <DocumentUploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
      />
    </PageWrapper>
  )
}
