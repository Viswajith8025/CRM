import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, Calendar, FileText, UserSquare2, Briefcase, Plus, Clock } from "lucide-react"
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
  timing: z.string().optional(),
  remarks: z.string().optional(),
})

interface Props {
  task?: Task
  onSuccess: () => void
}

export function DigitalMarketingTaskForm({ task, onSuccess }: Props) {
  const { profile } = useAuthStore()
  const { clients, fetchClients } = useCRMStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isManualClient, setIsManualClient] = useState(false)
  const [isManualTiming, setIsManualTiming] = useState(false)
  const [previousTimings, setPreviousTimings] = useState<string[]>(["10AM - 1PM", "1:30PM - 3:30PM", "4:15PM - 6:00PM"])

  useEffect(() => {
    fetchClients()
    fetchPreviousTimings()
  }, [])

  const fetchPreviousTimings = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('tasks')
        .select('description')
        .eq('assigned_to', profile.id)
        .not('description', 'is', null)
        .ilike('description', 'Client:%')

      if (data) {
        const extractedTimings = data
          .map(d => d.description?.includes('| Timing: ') ? d.description.split('| Timing: ')[1] : null)
          .filter(Boolean) as string[]

        if (extractedTimings.length > 0) {
          const uniqueTimings = Array.from(new Set(["10AM - 1PM", "1:30PM - 3:30PM", "4:15PM - 6:00PM", ...extractedTimings]))
          setPreviousTimings(uniqueTimings)
        }
      }
    } catch (e) {
      console.error("Failed to fetch previous timings", e)
    }
  }

  const eligibleClients = useMemo(() => {
    return clients.filter(c => {
      const s = c.service?.toLowerCase() || '';
      return s.includes('digital') || s.includes('marketing') || s.includes('seo') || s.includes('ads')
    })
  }, [clients])

  const defaultClient = task ? (task.description?.replace("Client: ", "") || "") : ""

  // Parse existing description for edit mode
  let defaultTiming = ""
  if (task?.description?.includes("| Timing: ")) {
    const parts = task.description.split("| Timing: ")
    defaultTiming = parts[1] || ""
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: defaultClient.split(" | Timing: ")[0],
      work: task?.title || "",
      status: task?.status === 'in_progress' ? 'ongoing' : (task?.status === 'done' ? 'done' : 'pending'),
      due_date: task?.due_date || new Date().toISOString().split('T')[0],
      timing: defaultTiming,
      remarks: task?.remarks || "",
    },
  })

  // FIX: Use useEffect to watch for manual_entry — never call setState during render
  const selectedClient = form.watch("client_name")
  const selectedTiming = form.watch("timing")

  useEffect(() => {
    if (selectedClient === "manual_entry") {
      setIsManualClient(true)
      form.setValue("client_name", "")
    }
  }, [selectedClient])

  useEffect(() => {
    if (selectedTiming === "manual_entry") {
      setIsManualTiming(true)
      form.setValue("timing", "")
    }
  }, [selectedTiming])

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
        description: `Client: ${values.client_name}${values.timing ? ` | Timing: ${values.timing}` : ''}`,
        remarks: values.remarks,
        status: dbStatus,
        priority: 'medium',
        project_id: null,
        module_id: null,
        assigned_to: profile.id,
        due_date: values.due_date,
        organization_id: profile.organization_id,
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
        timing: "",
        remarks: "",
      })
      setIsManualClient(false)
      setIsManualTiming(false)
      await fetchPreviousTimings()
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-start pt-2 pb-4">

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
                <Briefcase className="h-3 w-3" /> Activity (Tasks)
              </FormLabel>
              <FormControl>
                <Input placeholder="What to do today?" {...field} className="bg-muted/20" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
        {/* Timing */}
        <FormField
          control={form.control}
          name="timing"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> Timing
              </FormLabel>
              {!isManualTiming ? (
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-muted/20">
                      <SelectValue placeholder="Select Timing" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {previousTimings.map((t, idx) => (
                      <SelectItem key={idx} value={t}>{t}</SelectItem>
                    ))}
                    <SelectItem value="manual_entry" className="text-primary font-bold border-t mt-1 pt-1">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3" /> Add Custom Timing
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <div className="relative">
                    <Input placeholder="e.g. 10:00 AM - 12:00 PM" {...field} className="bg-muted/20 pr-20" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 text-[10px] uppercase font-bold"
                      onClick={() => {
                        setIsManualTiming(false)
                        form.setValue("timing", "")
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

        <div className="pt-[22px]">
          <Button type="submit" className="w-full font-black uppercase tracking-wider h-10" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {task?.id ? "Update" : "Add Task"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
