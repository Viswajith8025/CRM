import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, Calendar, ClipboardList, User2, Flag } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTasksStore } from "../tasksStore"
import { useProjectsStore } from "@/modules/projects"
import { useTeamStore } from "@/modules/admin"
import { toast } from "sonner"
import type { Task } from "../types/types"
import { sanitizeObject } from "@/lib/security"

const formSchema = z.object({
  title: z.string().min(2, "Task title is required").max(200),
  description: z.string().max(5000).optional(),
  remarks: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  project_id: z.string().min(1, "Project is required").uuid("Invalid Project ID"),
  assigned_to: z.string().optional().nullable().or(z.literal("none")),
  due_date: z.string().optional(),
  module_id: z.string().uuid().optional().nullable(),
})

interface TaskFormProps {
  task?: Task
  onSuccess: () => void
}

export default function TaskForm({ task, onSuccess }: TaskFormProps) {
  const { addTask, updateTask } = useTasksStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { members, fetchMembers } = useTeamStore()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchMembers()
  }, [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      remarks: task?.remarks || "",
      status: (task?.status as any) || "todo",
      priority: (task?.priority as any) || "medium",
      project_id: task?.project_id || "",
      assigned_to: task?.assigned_to || "none",
      due_date: task?.due_date || "",
      module_id: (task as any)?.module_id || null,
    },
  })

  const eligibleAssignees = useMemo(() => {
    const selectedProjId = form.watch("project_id")
    const activeProject = projects.find(p => p.id === selectedProjId)
    const projectDeptId = activeProject?.department_id

    const activeEmployees = members.filter(m => (!m.status || m.status === 'active') && m.role === 'employee')
    if (!projectDeptId) {
      return activeEmployees
    }
    return activeEmployees.filter(m => m.department_id === projectDeptId)
  }, [members, projects, form.watch("project_id")])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      // OWASP: Sanitize all inputs and validate strictly
      const sanitizedValues = sanitizeObject(values)
      const submitData = {
        ...sanitizedValues,
        project_id: sanitizedValues.project_id === "none" ? null : sanitizedValues.project_id,
        assigned_to: sanitizedValues.assigned_to === "none" ? null : sanitizedValues.assigned_to,
        module_id: sanitizedValues.module_id || null,
      }

      if (task?.id) {
        await updateTask(task.id, submitData)
        toast.success("Task updated successfully")
      } else {
        await addTask(submitData)
        toast.success("Task created successfully")
      }
      onSuccess()
    } catch (error) {
      console.error("Task Save Error:", error)
      toast.error("Failed to save task")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-[calc(100vh-140px)]">
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-8 pb-8">
            {/* SECTION 1: BASIC INFO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Task Definition</h3>
              </div>
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Task Summary</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Design system audit..." {...field} className="bg-muted/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Detailed Description</FormLabel>
                    <FormControl>
                      <textarea 
                        {...field} 
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Add more context..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Remarks / Notes</FormLabel>
                    <FormControl>
                      <textarea 
                        {...field} 
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Add any internal remarks..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION 2: ASSIGNMENT & DEADLINE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                  <User2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Ownership & Timeline</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Parent Project</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Link to project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.filter(p => !(p as any).is_archived && p.status !== 'completed' && p.status !== 'cancelled').map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
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
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Owner</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Assign someone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {eligibleAssignees.map(member => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Due Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input type="date" {...field} className="pl-9 bg-muted/20" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION 3: STATUS & PRIORITY */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                  <Flag className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Progress & Urgency</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Current status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Priority Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="flex gap-4 pt-6 border-t mt-auto">
          <Button type="submit" className="flex-1 font-black uppercase tracking-[0.2em]" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {task?.id ? "Update Task" : "Launch Task"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

