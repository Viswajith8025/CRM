import { useState, useEffect } from "react"
import { useDocumentStore } from "../documentStore"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  File, 
  Image as ImageIcon, 
  Search, 
  Download, 
  ExternalLink,
  History,
  MoreVertical,
  Trash2
} from "lucide-react"
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DocumentListProps {
  projectId?: string
}

export function DocumentList({ projectId }: DocumentListProps) {
  const { documents, fetchDocuments, deleteDocument, isLoading } = useDocumentStore()
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetchDocuments(projectId)
  }, [projectId])

  const getFileIcon = (type: string) => {
    const t = type.toLowerCase()
    if (['pdf'].includes(t)) return <FileText className="h-5 w-5 text-rose-500" />
    if (['doc', 'docx'].includes(t)) return <FileText className="h-5 w-5 text-blue-500" />
    if (['xls', 'xlsx', 'csv'].includes(t)) return <FileText className="h-5 w-5 text-emerald-500" />
    if (['png', 'jpg', 'jpeg', 'svg'].includes(t)) return <ImageIcon className="h-5 w-5 text-purple-500" />
    return <File className="h-5 w-5 text-muted-foreground" />
  }

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.project?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpenDoc = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">Loading documents...</TableCell>
              </TableRow>
            ) : filteredDocs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No documents found.</TableCell>
              </TableRow>
            ) : (
              filteredDocs.map(doc => (
                <TableRow key={doc.id} className="group hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getFileIcon(doc.file_type)}
                      <div className="flex flex-col">
                        <span 
                          className="font-bold text-sm hover:underline cursor-pointer transition-colors group-hover:text-primary"
                          onClick={() => handleOpenDoc(doc.file_url)}
                        >
                          {doc.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {doc.file_type} • {doc.file_size} KB • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px]">{doc.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {doc.project?.name ? (
                      <span className="text-sm font-medium">{doc.project.name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">General</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">v{doc.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={doc.profile?.avatar_url || ""} />
                        <AvatarFallback className="text-[10px]">{doc.profile?.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{doc.profile?.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Document Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenDoc(doc.file_url)}>
                          <ExternalLink className="h-4 w-4 mr-2" /> Open File
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Download className="h-4 w-4 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <History className="h-4 w-4 mr-2" /> Version History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-rose-500 focus:text-rose-600 focus:bg-rose-50"
                          onClick={() => deleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
