import { useEffect } from "react"
import { useDocumentStore } from "../documentStore"
import { Button } from "@/components/ui/button"
import { 
  FileIcon, 
  Download, 
  Trash2, 
  Eye, 
  MoreHorizontal,
  ExternalLink,
  Paperclip
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface AttachmentListProps {
  relatedId: string
  relatedType: 'task' | 'invoice' | 'project' | 'client' | 'other'
}

export function AttachmentList({ relatedId, relatedType }: AttachmentListProps) {
  const { documents, fetchDocuments, deleteDocument, isLoading } = useDocumentStore()

  useEffect(() => {
    fetchDocuments(relatedId, relatedType)
  }, [relatedId, relatedType])

  const handleDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      // Fallback: Just open in new tab
      window.open(url, '_blank')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return
    try {
      await deleteDocument(id)
      toast.success("File deleted")
    } catch (err) {
      toast.error("Failed to delete file")
    }
  }

  if (isLoading && documents.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed rounded-xl bg-muted/10">
        <Paperclip className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground font-medium">No attachments yet</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {documents.map((doc) => (
        <div 
          key={doc.id} 
          className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors group"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="truncate">
              <p className="text-sm font-bold truncate leading-none mb-1">{doc.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{(doc.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                {doc.profile && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-primary/70">by {doc.profile.full_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hidden sm:flex"
              onClick={() => window.open(doc.file_url, '_blank')}
            >
              <Eye className="h-4 w-4 text-muted-foreground" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload(doc.file_url, doc.name)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive" 
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  )
}
