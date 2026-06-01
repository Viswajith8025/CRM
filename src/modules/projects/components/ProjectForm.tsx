import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, Briefcase, Calendar, Users } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
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
import { useProjectsStore } from "../projectsStore"
import { useTeamStore } from "@/modules/admin"
import { toast } from "sonner"
import { useCRMStore } from "@/modules/crm"
import type { Project } from "../types"
import { sanitizeObject } from "@/lib/security"
import { useDepartmentStore } from "@/modules/dashboard/useDepartmentStore"

const formSchema = z.object({
  name: z.string().min(2, "Project name is required").max(100),
  type: z.enum(['Software', 'Website', 'Marketing', 'Ecommerce', 'Other']),
  description: z.string().max(2000).optional(),
  remarks: z.string().max(2000).optional(),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  lead_id: z.string().optional(),
  client_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  member_ids: z.array(z.string()).default([]),
})

interface ProjectFormProps {
  project?: Project
  onSuccess: () => void
}

export default function ProjectForm({ project, onSuccess }: ProjectFormProps) {
  const { addProject, updateProject } = useProjectsStore()
  const { members, fetchMembers } = useTeamStore()
  const { clients, fetchClients } = useCRMStore()
  const { departments, fetchDepartments } = useDepartmentStore()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchMembers()
    fetchClients()
    fetchDepartments()
  }, [])

  const realClients = useMemo(() => {
    // Filter out virtual clients (leads that haven't been converted to real client records)
    return clients.filter(c => !c.isVirtual)
  }, [clients])

  const activeMembers = useMemo(() => {
    return members.filter(m => m.status === 'active')
  }, [members])

  // Only show active departments in the dropdown
  const activeDepartments = useMemo(() => {
    const active = departments.filter(d => d.status === 'active')
    // If editing a project with an inactive dept, include it so existing data isn't lost
    if (project?.department_id) {
      const currentDept = departments.find(d => d.id === project.department_id)
      if (currentDept && currentDept.status !== 'active') {
        return [...active, currentDept]
      }
    }
    return active
  }, [departments, project])


  const eligibleLeads = useMemo(() => {
    return activeMembers.filter(m => {
      const roleLower = m.role?.toLowerCase() || ''
      const dynLower = m.dynamic_role_name?.toLowerCase() || ''
      return (
        roleLower === 'teamlead' ||
        roleLower === 'team lead' ||
        dynLower === 'teamlead' ||
        dynLower === 'team lead' ||
        dynLower.includes('team lead') ||
        dynLower.includes('teamlead')
      )
    })
  }, [activeMembers])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || "",
      type: project?.type || "Software",
      description: project?.description || "",
      remarks: project?.remarks || "",
      status: (project?.status as any) || "planning",
      start_date: project?.start_date || new Date().toISOString().split('T')[0],
      end_date: project?.end_date || "",
      lead_id: project?.lead?.id || "",
      client_id: project?.client?.id || "",
      department_id: project?.department_id || "",
      member_ids: project?.members?.map(m => m.id) || [],
    },
  })


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      // OWASP: Sanitize all inputs
      const sanitizedValues = sanitizeObject(values)
      const { lead_id, member_ids, ...projectData } = sanitizedValues
      let finalClientId = !projectData.client_id || projectData.client_id === "none" ? null : projectData.client_id
      let finalDeptId = !projectData.department_id || projectData.department_id === "none" ? null : projectData.department_id

      // Only attempt lead→client conversion if the ID is NOT already a real client record
      if (finalClientId) {
        try {
          const { clients } = useCRMStore.getState()
          const isAlreadyClient = clients.some(c => c.id === finalClientId && !c.isVirtual)
          if (!isAlreadyClient) {
            finalClientId = await useCRMStore.getState().ensureClientFromLead(finalClientId)
          }
        } catch (err) {
          console.error("Client conversion check failed:", err)
          // Non-fatal — proceed with the original ID so the project still saves
        }
      }
      const finalStartDate = !projectData.start_date ? null : projectData.start_date
      const finalEndDate = !projectData.end_date ? null : projectData.end_date

      const finalProjectData = {
        ...projectData,
        client_id: finalClientId,
        department_id: finalDeptId,
        start_date: finalStartDate,
        end_date: finalEndDate
      }

      if (project) {
        await updateProject(project.id, finalProjectData, lead_id, member_ids)
        toast.success("Project updated successfully")
      } else {
        await addProject(finalProjectData, lead_id, member_ids)
        toast.success("Project created successfully")
      }
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error("Failed to save project")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-[calc(100vh-140px)]">
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-8 pb-8">
            {/* SECTION 1: PROJECT OVERVIEW */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Briefcase className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Project Overview</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Website Redesign" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Project Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Software">Software</SelectItem>
                          <SelectItem value="Website">Website</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Ecommerce">Ecommerce</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Assigned Client</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder={realClients.length > 0 ? "Select a client" : "No clients found (Run recovery script)"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Internal / No Client</SelectItem>
                          {realClients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
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
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Assigned Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None / All Departments</SelectItem>
                          {activeDepartments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                              {dept.status === 'inactive' && (
                                <span className="ml-1 text-[10px] text-muted-foreground">(inactive)</span>
                              )}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Description (Optional)</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Remarks / Internal Notes (Optional)</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        placeholder="Add internal remarks..."
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION 2: TIMELINE & STATUS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Timeline & Status</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Current Phase</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Kick-off Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Target Deadline</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SECTION 3: TEAM ASSIGNMENT */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Team Assignment</h3>
              </div>

              <FormField
                control={form.control}
                name="lead_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Project Lead / HR</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/20">
                          <SelectValue placeholder="Select Team lead" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eligibleLeads.map(member => (
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
          </div>
        </ScrollArea>

        <div className="flex gap-4 pt-6 border-t mt-auto">
          <Button type="submit" className="flex-1 font-black uppercase tracking-[0.2em]" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {project ? "Update Project" : "Initialize Project"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

