import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDocumentStore } from "../documentStore"
import { useProjectsStore } from "@/modules/projects/projectsStore"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Loader2, UploadCloud } from "lucide-react"

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  category: z.enum(['proposal', 'contract', 'asset', 'general']),
  project_id: z.string().optional(),
  client_id: z.string().optional(),
  file: z.any().refine((val) => val !== undefined, "File is required")
})

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  defaultProjectId?: string
}

export function DocumentUploadModal({ isOpen, onClose, defaultProjectId }: DocumentUploadModalProps) {
  const { addDocument } = useDocumentStore()
  const { projects, fetchProjects } = useProjectsStore()
  const [clients, setClients] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      supabase.from('clients').select('id, name').then(({ data }) => setClients(data || []))
    }
  }, [isOpen])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      category: "general",
      project_id: defaultProjectId || "none",
      client_id: "none",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedFile) {
      toast.error("Please select a file to upload")
      return
    }

    setIsLoading(true)
    try {
      // Simulate file upload to Supabase Storage Bucket
      // In a real app, you would use supabase.storage.from('documents').upload(...)
      await new Promise(resolve => setTimeout(resolve, 1500)) 
      
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'unknown'
      const fileSize = Math.round(selectedFile.size / 1024) // KB
      
      // Generate a dummy secure URL for MVP
      const dummyUrl = `https://erppro-storage.com/docs/${crypto.randomUUID()}.${fileExt}`

      await addDocument({
        title: values.title,
        file_url: dummyUrl,
        file_type: fileExt,
        file_size: fileSize,
        category: values.category,
        project_id: values.project_id === "none" ? null : values.project_id,
        client_id: values.client_id === "none" ? null : values.client_id,
        status: 'active',
        version: 1
      })

      toast.success("Document uploaded successfully")
      form.reset()
      setSelectedFile(null)
      onClose()
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="border-2 border-dashed border-border/50 rounded-xl p-6 flex flex-col items-center justify-center bg-muted/20 relative hover:bg-muted/30 transition-colors cursor-pointer group">
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setSelectedFile(e.target.files[0])
                    if (!form.getValues('title')) {
                      // Auto-fill title from filename
                      form.setValue('title', e.target.files[0].name.split('.')[0])
                    }
                  }
                }}
              />
              <UploadCloud className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-sm font-bold text-primary">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium">Click or drag file to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, PNG up to 50MB</p>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Website Proposal v1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="asset">Design Asset</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Project</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Project</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full mt-4 gap-2" disabled={isLoading || !selectedFile}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Uploading..." : "Save Document"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
