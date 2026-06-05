import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, Calendar, FileText, UserSquare2, Briefcase, MapPin, Mic, Plus } from "lucide-react"
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
  due_date: z.string().min(1, "Required"),
  description: z.string().min(1, "Required"),
  place_time: z.string().min(1, "Required"),
  client_name: z.string().min(1, "Required"),
  status: z.enum(['pending', 'ongoing', 'done']),
  anchor: z.string().optional(),
  remarks: z.string().optional(),
})

interface Props {
  task?: Task
  onSuccess: () => void
}

export function VideographyTaskForm({ task, onSuccess }: Props) {
  const { profile } = useAuthStore()
  const { clients, fetchClients } = useCRMStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isManualClient, setIsManualClient] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  const eligibleClients = useMemo(() => {
    return clients.filter(c =>
      c.service?.toLowerCase().includes('shoot') ||
      c.service?.toLowerCase().includes('videography') ||
      c.service?.toLowerCase().includes('production')
    )
  }, [clients])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      due_date: new Date().toISOString().split('T')[0],
      description: "",
      place_time: "",
      client_name: "",
      status: "pending",
      anchor: "",
      remarks: "",
    },
  })

  const selectedClient = form.watch("client_name")

  useEffect(() => {
    if (selectedClient === "manual_entry") {
      setIsManualClient(true)
      form.setValue("client_name", "")
    }
  }, [selectedClient])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      if (!profile?.id) throw new Error("Not authenticated")
      if (!profile?.organization_id) throw new Error("No organization context")

      const dbStatus = values.status === 'ongoing' ? 'in_progress' : (values.status === 'pending' ? 'todo' : 'done')

      const descParts = [`Client: ${values.client_name}`, `Place: ${values.place_time}`]
      if (values.anchor) {
        descParts.push(`Anchor: ${values.anchor}`)
      }

      const payload = {
        title: values.description,
        description: descParts.join(' | '),
        status: dbStatus,
        priority: 'medium',
        project_id: null,
        module_id: null,
        assigned_to: profile.id,
        due_date: values.due_date,
        organization_id: profile.organization_id,
        remarks: values.remarks,
      }

      const { error } = await supabase.from('tasks').insert(payload)

      if (error) throw new Error(error.message)

      toast.success("Shoot logged successfully!")

      form.reset({
        due_date: new Date().toISOString().split('T')[0],
        description: "",
        place_time: "",
        client_name: "",
        status: "pending",
        anchor: "",
        remarks: "",
      })
      setIsManualClient(false)
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4 items-start pt-2 pb-4">
        
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

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-3 w-3" /> Description
              </FormLabel>
              <FormControl>
                <Input placeholder="Shoot desc..." {...field} className="bg-muted/20" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Place & Time */}
        <FormField
          control={form.control}
          name="place_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Place & Time
              </FormLabel>
              <FormControl>
                <Input placeholder="Destination..." {...field} className="bg-muted/20" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {eligibleClients.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value="manual_entry" className="text-primary font-bold border-t mt-1 pt-1">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3" /> Custom Client
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <div className="relative">
                    <Input placeholder="Client..." {...field} className="bg-muted/20 pr-16" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 text-[9px] uppercase font-bold"
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

        {/* Anchor */}
        <FormField
          control={form.control}
          name="anchor"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <Mic className="h-3 w-3" /> Anchor
              </FormLabel>
              <FormControl>
                <Input placeholder="Name..." {...field} className="bg-muted/20" />
              </FormControl>
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
                <Input placeholder="Notes..." {...field} className="bg-muted/20" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-[24px]">
          <Button type="submit" className="w-full font-black uppercase tracking-wider h-10" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Task
          </Button>
        </div>
      </form>
    </Form>
  )
}
