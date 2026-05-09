import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { useTimeStore } from "../timeStore"
import { useTasksStore } from "@/modules/tasks"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { differenceInMinutes } from "date-fns"
import { Switch } from "@/components/ui/switch"

const formSchema = z.object({
  task_id: z.string().optional(),
  description: z.string().min(2, "Description is required"),
  start_date: z.string().min(1, "Start date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  is_billable: z.boolean().default(true)
})

interface TimeLogFormProps {
  log?: any
  onSuccess: () => void
}

export function TimeLogForm({ log, onSuccess }: TimeLogFormProps) {
  const { addManualLog, updateManualLog } = useTimeStore()
  const { tasks, fetchTasks } = useTasksStore()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_id: log?.task_id || "none",
      description: log?.description || "",
      start_date: log ? new Date(log.start_time).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      start_time: log ? new Date(log.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : "09:00",
      end_time: log ? new Date(log.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : "10:00",
      is_billable: log?.is_billable !== undefined ? log.is_billable : true
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const startDateTime = new Date(`${values.start_date}T${values.start_time}`)
      const endDateTime = new Date(`${values.start_date}T${values.end_time}`)
      
      if (endDateTime <= startDateTime) {
        toast.error("End time must be after start time")
        setIsLoading(false)
        return
      }

      const duration_minutes = differenceInMinutes(endDateTime, startDateTime)

      const submitData = {
        task_id: values.task_id === "none" ? null : values.task_id,
        description: values.description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration_minutes,
        is_billable: values.is_billable
      }

      if (log) {
        await updateManualLog(log.id, submitData)
        toast.success("Time log updated")
      } else {
        await addManualLog(submitData)
        toast.success("Time logged successfully")
      }
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || "Failed to save time log")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="task_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task (Optional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No Task Attached</SelectItem>
                  {tasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="What did you work on?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="start_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_billable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Billable Time</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Include this time log in client invoices.
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full mt-6 gap-2" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Saving..." : log ? "Update Time Log" : "Log Manual Time"}
        </Button>
      </form>
    </Form>
  )
}
