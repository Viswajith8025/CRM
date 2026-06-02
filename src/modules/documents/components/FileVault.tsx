import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Folder, 
  File, 
  MoreHorizontal, 
  Download, 
  Trash2, 
  Upload, 
  Search, 
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Archive,
  Grid,
  List as ListIcon,
  Plus
} from 'lucide-react'
import { useDocumentStore } from '../documentStore'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { DocumentRecord } from '../types'
import { useInView } from 'react-intersection-observer'

interface FileVaultProps {
  clientId?: string
  projectId?: string
}

const DEFAULT_FOLDERS = ['Projects', 'Invoices', 'Contracts', 'Assets']

export function FileVault({ clientId, projectId }: FileVaultProps) {
  const { documents, fetchDocuments, deleteDocument, bulkUpload, isLoading } = useDocumentStore()
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const { ref, inView } = useInView()

  useEffect(() => {
    // Reset state on project/client change
    setPage(1)
    setHasMore(true)
    fetchDocuments(projectId, projectId ? 'project' : undefined, clientId, 1, 20).then(docs => {
      setHasMore(docs.length === 20)
    })
  }, [clientId, projectId])

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    const nextPage = page + 1
    const newDocs = await fetchDocuments(projectId, projectId ? 'project' : undefined, clientId, nextPage, 20)
    setPage(nextPage)
    if (newDocs.length < 20) setHasMore(false)
  }, [page, isLoading, hasMore, projectId, clientId, fetchDocuments])

  useEffect(() => {
    if (inView && hasMore) {
      loadMore()
    }
  }, [inView, hasMore, loadMore])

  const filteredDocs = documents.filter(doc => {
    const matchesFolder = currentFolder ? doc.folder === currentFolder : true
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase())
    return matchesFolder && matchesSearch
  })

  const folderStats = DEFAULT_FOLDERS.reduce((acc, folder) => {
    acc[folder] = documents.filter(doc => doc.folder === folder).length
    return acc
  }, {} as Record<string, number>)

  const getFileIcon = (mime: string) => {
    if (mime.includes('image')) return <ImageIcon className="h-4 w-4 text-pink-500" />
    if (mime.includes('pdf') || mime.includes('word')) return <FileText className="h-4 w-4 text-blue-500" />
    if (mime.includes('zip') || mime.includes('rar')) return <Archive className="h-4 w-4 text-amber-500" />
    return <File className="h-4 w-4 text-slate-400" />
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    bulkUpload(
      Array.from(files), 
      'documents', 
      projectId || clientId || 'vault', 
      projectId ? 'project' : 'client',
      currentFolder || 'Assets',
      clientId
    ).then(() => {
      toast.success("Files uploaded successfully")
    }).catch(() => {
      toast.error("Upload failed")
    })
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <button 
            onClick={() => setCurrentFolder(null)}
            className={cn("hover:text-primary transition-colors", !currentFolder && "text-primary")}
          >
            Vault
          </button>
          {currentFolder && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-primary">{currentFolder}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search files..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Button 
              variant={view === 'grid' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setView('grid')}
            >
              <Grid className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant={view === 'list' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setView('list')}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          <label className="cursor-pointer">
            <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            <Button className="h-9 gap-2 font-bold text-xs">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </label>
        </div>
      </div>

      {!currentFolder && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEFAULT_FOLDERS.map((folder) => (
            <Card 
              key={folder}
              className="group cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-card/30 backdrop-blur-xl border-border/50"
              onClick={() => setCurrentFolder(folder)}
            >
              <div className="p-5 flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Folder className="h-6 w-6 text-primary fill-primary/20" />
                </div>
                <div>
                  <h4 className="font-black text-sm">{folder}</h4>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    {folderStats[folder] || 0} Files
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* File List */}
      {(currentFolder || search) && (
        <div className={cn(
          view === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
            : "space-y-1"
        )}>
          {filteredDocs.length === 0 ? (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center opacity-50">
              <File className="h-12 w-12 mb-4 text-muted-foreground/30" />
              <p className="text-sm font-bold uppercase tracking-widest">No files found</p>
            </div>
          ) : filteredDocs.map((doc) => (
            view === 'grid' ? (
              <Card 
                key={doc.id}
                className="group relative overflow-hidden bg-card/30 backdrop-blur-xl border-border/50 hover:border-primary/50 transition-all"
              >
                <div className="aspect-square flex flex-col items-center justify-center p-6 bg-muted/20">
                  <div className="h-16 w-16 mb-4">
                    {doc.mime_type.includes('image') ? (
                      <img src={doc.file_url} className="h-full w-full object-cover rounded-lg shadow-sm" alt={doc.name} />
                    ) : (
                      <div className="h-full w-full rounded-lg bg-background flex items-center justify-center border">
                         {getFileIcon(doc.mime_type)}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-center line-clamp-2 px-2">{doc.name}</span>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full shadow-lg" asChild>
                    <a href={doc.file_url} download target="_blank">
                      <Download className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="h-7 w-7 rounded-full shadow-lg"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ) : (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 group transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded bg-background flex items-center justify-center shrink-0 border">
                    {getFileIcon(doc.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')} • {(doc.size_bytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <a href={doc.file_url} download target="_blank">
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 hover:text-rose-500"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      {hasMore && (currentFolder || search) && (
        <div ref={ref} className="py-4 text-center text-xs text-muted-foreground animate-pulse">
          Loading more files...
        </div>
      )}
    </div>
  )
}
