import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useDocumentStore } from "../documentStore"
import { useAuthStore } from "@/store/useAuthStore"
import { FileUploadZone } from "../components/FileUploadZone"
import { 
  FileText, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Download, 
  Trash2, 
  History, 
  ExternalLink,
  ShieldAlert,
  Files
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DocumentVault() {
  const { documents, fetchDocuments, deleteDocument, isLoading, trackAccess } = useDocumentStore()
  const { profile } = useAuthStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    fetchDocuments()
  }, [])

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab = activeTab === "all" || doc.related_entity_type === activeTab
    return matchesSearch && matchesTab
  })

  const handleDownload = (doc: any) => {
    trackAccess(doc.id)
    window.open(doc.file_url, '_blank')
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return
    try {
      await deleteDocument(id)
      toast.success("Document deleted successfully")
    } catch (err) {
      toast.error("Failed to delete document")
    }
  }

  return (
    <PageWrapper 
      title="Enterprise Document Vault" 
      description="Centralized storage for projects, invoices, clients, and HR documents with version control."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search documents by name, tag, or entity..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all">All Assets</TabsTrigger>
            <TabsTrigger value="project">Projects</TabsTrigger>
            <TabsTrigger value="invoice">Invoices</TabsTrigger>
            <TabsTrigger value="client">Clients</TabsTrigger>
            {profile?.role !== 'employee' && (
              <TabsTrigger value="hr" className="gap-2">
                <ShieldAlert className="h-3 w-3" /> HR Records
              </TabsTrigger>
            )}
          </TabsList>

          <div className="mt-6 border rounded-xl bg-card overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">Loading vault...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Files className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">No documents found</h3>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or upload a new file.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Modified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold truncate group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleDownload(doc)}>
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                              {(doc.size_bytes / 1024).toFixed(1)} KB • {doc.mime_type?.split('/')[1] || 'FILE'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-[10px] font-black">
                          {doc.related_entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <History className="h-3 w-3 text-muted-foreground" />
                          v{doc.version_number || 1}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(doc.updated_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleDownload(doc)} className="gap-2">
                              <Download className="h-4 w-4" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <History className="h-4 w-4" /> View Versions
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(doc.id)} className="gap-2 text-rose-500 font-bold">
                              <Trash2 className="h-4 w-4" /> Delete Asset
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tighter">Instant Upload</h3>
            <FileUploadZone 
              bucket="documents" 
              relatedId="vault-root" 
              relatedType="other" 
              onUploadSuccess={() => fetchDocuments()}
            />
          </div>
          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 flex flex-col justify-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold">Security Compliance</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All documents are encrypted at rest and isolated by organization. HR and Finance folders require special administrative clearance.
              </p>
            </div>
            <Button className="w-full font-black">Audit Access Logs</Button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
