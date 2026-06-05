import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, Calendar, FileText, UserSquare2, Briefcase, Plus } from "lucide-react"
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
import { useAuthStore } from "@/store/useAuthStore"
import { useCRMStore } from "@/modules/crm/crmStore"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Task } from "../types/types"

const formSchema = z.object({
  client_name: z.string().min(1, "Client name is required"),
  work: z.string().min(1, "Work description is required"),
  status: z.enum(['pending', 'ongoing', 'done']),
  due_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional(),
})

interface Props {
  task?: Task
  onSuccess: () => void
}

export function VideoEditingTaskForm({ task, onSuccess }: Props) {
  const { profile } = useAuthStore()
  const { clients, fetchClients } = useCRMStore()
  const [isLoading, setIsLoading] = useState(false)
  const [previousWorks, setPreviousWorks] = useState<string[]>([])
  const [isManualClient, setIsManualClient] = useState(false)
  const [isManualWork, setIsManualWork] = useState(false)

  useEffect(() => {
    fetchClients()
    fetchPreviousWorks()
  }, [])

  const fetchPreviousWorks = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('tasks')
        .select('title')
        .eq('assigned_to', profile.id)
        .not('description', 'is', null)
        .ilike('description', 'Client:%')

      if (data) {
        const works = Array.from(new Set(data.map(d => d.title).filter(Boolean)))
        setPreviousWorks(works)
      }
    } catch (e) {
      console.error("Failed to fetch previous works", e)
    }
  }

  const eligibleClients = useMemo(() => {
    return clients.filter(c =>
      c.service?.toLowerCase().includes('video') ||
      c.service?.toLowerCase().includes('edit')
    )
  }, [clients])

  const defaultClient = task ? (task.description?.replace("Client: ", "") || "") : ""

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: defaultClient,
      work: task?.title || "",
      status: task?.status === 'in_progress' ? 'ongoing' : (task?.status === 'done' ? 'done' : 'pending'),
      due_date: task?.due_date || new Date().toISOString().split('T')[0],
      remarks: task?.remarks || "",
    },
  })

  // FIX: Use useEffect to watch for manual_entry — never call setState during render
  const selectedClient = form.watch("client_name")
  const selectedWork = form.watch("work")

  useEffect(() => {
    if (selectedClient === "manual_entry") {
      setIsManualClient(true)
      form.setValue("client_name", "")
    }
  }, [selectedClient])

  useEffect(() => {
    if (selectedWork === "manual_entry") {
      setIsManualWork(true)
      form.setValue("work", "")
    }
  }, [selectedWork])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      if (!profile?.id) throw new Error("Not authenticated")
      if (!profile?.organization_id) throw new Error("No organization context")

      // Map our simple status values to the DB enum
      const dbStatus = values.status === 'ongoing' ? 'in_progress' : (values.status === 'pending' ? 'todo' : 'done')

      // Insert directly via supabase to avoid complex RLS chain in addTask store
      const payload = {
        title: values.work,
        description: `Client: ${values.client_name}`,
        status: dbStatus,
        priority: 'medium',
        project_id: null,
        module_id: null,
        assigned_to: profile.id,
        due_date: values.due_date,
        organization_id: profile.organization_id,
        remarks: values.remarks,
      }

      let error: any = null

      if (task?.id) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', task.id)
          .eq('organization_id', profile.organization_id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert(payload)
        error = insertError
      }

      if (error) {
        console.error("Supabase error:", error)
        throw new Error(error.message || "Failed to save task")
      }

      toast.success(task?.id ? "Task updated!" : "Work logged successfully!")

      form.reset({
        client_name: "",
        work: "",
        status: "pending",
        due_date: new Date().toISOString().split('T')[0],
        remarks: "",
      })
      setIsManualClient(false)
      setIsManualWork(false)
      await fetchPreviousWorks()
      onSuccess()
    } catch (error: any) {
      console.error("Task Save Error:", error)
      toast.error(error?.message || "Failed to save task")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2 pb-4">

        {/* Client Name */}
        <FormField
          control={form.control}
          name="client_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <UserSquare2 className="h-3 w-3" /> Client Name
              </FormLabel>
              {!isManualClient ? (
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-muted/20">
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {eligibleClients.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value="manual_entry" className="text-primary font-bold border-t mt-1 pt-1">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3" /> Add Client Manually
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <div className="relative">
                    <Input placeholder="Enter Client Name..." {...field} className="bg-muted/20 pr-20" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 text-[10px] uppercase font-bold"
                      onClick={() => {
                        setIsManualClient(false)
                        form.setValue("client_name", "")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Work */}
        <FormField
          control={form.control}
          name="work"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-3 w-3" /> Work
              </FormLabel>
              {!isManualWork ? (
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-muted/20">
                      <SelectValue placeholder="Select Work Type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {previousWorks.map((w, idx) => (
                      <SelectItem key={idx} value={w}>{w}</SelectItem>
                    ))}
                    <SelectItem value="manual_entry" className="text-primary font-bold border-t mt-1 pt-1">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3" /> Add New Work Manually
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <div className="relative">
                    <Input placeholder="e.g. Poster, Reel, Blog Post..." {...field} className="bg-muted/20 pr-20" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 text-[10px] uppercase font-bold"
                      onClick={() => {
                        setIsManualWork(false)
                        form.setValue("work", "")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Status
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-muted/20">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date */}
          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Date
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-muted/20" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Remarks */}
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <FileText className="h-3 w-3" /> Remarks
              </FormLabel>
              <FormControl>
                <Input placeholder="Any additional notes..." {...field} className="bg-muted/20" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-black uppercase tracking-[0.2em] mt-4" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {task?.id ? "Update Work" : "Log Work"}
        </Button>
      </form>
    </Form>
  )
}
