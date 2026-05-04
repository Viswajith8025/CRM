import { useState, useCallback } from "react"
import { useDocumentStore } from "../documentStore"
import { Button } from "@/components/ui/button"
import { Loader2, UploadCloud, X, FileIcon, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  relatedId: string
  relatedType: 'task' | 'invoice' | 'project' | 'client' | 'other'
  bucket: 'task-attachments' | 'invoices' | 'documents'
  onSuccess?: () => void
  allowBulk?: boolean
}

export function FileUploadZone({ 
  relatedId, 
  relatedType, 
  bucket, 
  onSuccess,
  allowBulk = true 
}: FileUploadZoneProps) {
  const { uploadFile, isLoading } = useDocumentStore()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      if (!allowBulk) {
        setSelectedFiles([files[0]])
      } else {
        setSelectedFiles(prev => [...prev, ...files])
      }
    }
  }, [allowBulk])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      if (!allowBulk) {
        setSelectedFiles([files[0]])
      } else {
        setSelectedFiles(prev => [...prev, ...files])
      }
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    let successCount = 0
    for (const file of selectedFiles) {
      try {
        await uploadFile({
          file,
          bucket,
          relatedId,
          relatedType
        })
        successCount++
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)`)
      setSelectedFiles([])
      onSuccess?.()
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer group",
          isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/50 hover:bg-muted/30",
          isLoading && "opacity-50 pointer-events-none"
        )}
      >
        <input
          type="file"
          multiple={allowBulk}
          onChange={handleFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <UploadCloud className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold">
            Click or drag to upload {allowBulk ? "files" : "a file"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max 50MB per file. High-speed secure storage.
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="bg-muted/30 rounded-xl border border-border/50 divide-y divide-border/50 overflow-hidden">
          <div className="p-3 bg-muted/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Queue ({selectedFiles.length})
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs font-bold" 
              onClick={() => setSelectedFiles([])}
            >
              Clear All
            </Button>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {selectedFiles.map((file, i) => (
              <div key={i} className="p-3 flex items-center justify-between group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="p-3 bg-muted/50">
            <Button 
              className="w-full font-bold h-10 gap-2" 
              onClick={handleUpload}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isLoading ? "Uploading..." : `Upload ${selectedFiles.length} File(s)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
