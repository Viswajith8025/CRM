import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useNavigate, Link } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Calendar, 
  IndianRupee, 
  User, 
  CheckCircle2, 
  Circle, 
  ChevronRight,
  Archive,
  Trash2,
  Plus,
  Clock,
  FileText,
  ShieldAlert
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useTasksStore } from "@/modules/tasks"
import { useProjectsStore } from "../projectsStore"
import { Progress } from "@/components/ui/progress"
import { format } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import ProjectForm from "../components/ProjectForm"
import TaskForm from "@/modules/tasks/components/TaskForm"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Project, Milestone } from "../types"
import { MilestoneForm } from "../components/MilestoneForm"
import { Skeleton } from "@/components/ui/skeleton"
import { FileUploadZone } from "@/modules/documents/components/FileUploadZone"
import { AttachmentList } from "@/modules/documents/components/AttachmentList"
import { useAuthStore } from "@/store/useAuthStore"
import { usePermissions } from "@/hooks/usePermissions"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CommentSection } from "@/components/shared/comments/CommentSection"
import { ProjectHealthCard } from "../components/ProjectHealthCard"
import { ProjectProfitabilityCard } from "../components/ProjectProfitabilityCard"
import { ModulesTab } from "../components/ModulesTab"
import { useDepartmentStore } from "@/modules/dashboard/useDepartmentStore"

function LoadingState() {
  return (
    <PageWrapper title="Loading Project..." description="Fetching latest workspace data">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    </PageWrapper>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, fetchTasks, subscribeToTasks, deleteTask, updateTask } = useTasksStore()
  const { getProjectById, fetchMilestones, updateProject, deleteProject, archiveProject, updateMilestone, fetchSprints, sprints } = useProjectsStore()
  const { profile } = useAuthStore()
  const { hasPermission } = usePermissions()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const canManageProjects = hasPermission('projects.manage')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const { departments, fetchDepartments } = useDepartmentStore()
  const projectSprints = id ? sprints[id] || [] : []
  const [submission, setSubmission] = useState<any | null>(null)

  const loadData = async () => {
    if (!id) return
    const [projData, mileData] = await Promise.all([
      getProjectById(id),
      fetchMilestones(id),
      fetchTasks({ projectId: id }),
      fetchSprints(id)
    ])
    setProject(projData)
    setMilestones(mileData)
    setLoading(false)

    if (projData?.client_id) {
      supabase
        .from('form_submissions')
        .select(`
          id,
          status,
          completion_rate,
          updated_at,
          template:form_templates (
            name,
            service_type,
            sections:form_sections (
              id,
              title,
              sort_order,
              fields:form_fields (id, label, field_type, is_sensitive, sort_order)
            )
          ),
          answers:form_submission_answers (field_id, answer_value, answer_encrypted)
        `)
        .eq('client_id', projData.client_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error(error)
          if (data) {
            const t = data.template as any
            const sortedSections = (t?.sections || [])
              .sort((a: any, b: any) => a.sort_order - b.sort_order)
              .map((s: any) => ({
                id: s.id,
                title: s.title,
                fields: (s.fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
              }))
            setSubmission({
              ...data,
              template_sections: sortedSections,
              answers: data.answers || []
            })
          }
        })
    }
  }

  useEffect(() => {
    fetchDepartments()
    loadData()
    const unsubscribe = subscribeToTasks(id) // project-scoped real-time
    return () => unsubscribe()
  }, [id])

  const handleArchive = async () => {
    if (!project) return
    try {
      await archiveProject(project.id)
      toast.success("Project archived")
      loadData()
    } catch (error: any) {
      console.error("[Archive Project]", error)
      toast.error(`Failed to archive: ${error?.message || "Unknown error"}`)
    }
  }

  const handleDelete = async () => {
    if (!project) return
    try {
      // (Forced HMR update)
      await deleteProject(project.id)
      toast.success("Project deleted successfully")
      navigate('/projects')
    } catch (error: any) {
      const msg = error?.message || "Failed to delete project"
      toast.error(msg)
      console.error("[Delete Project]", error)
    }
  }

  const handleToggleMilestone = async (m: Milestone) => {
    try {
      await updateMilestone(m.id, { is_completed: !m.is_completed })
      loadData()
      toast.success("Milestone updated")
    } catch (error) {
      toast.error("Failed to update milestone")
    }
  }

  if (loading) return <LoadingState />
  if (!project) return <div>Project not found</div>

  return (
    <PageWrapper 
      title={project.name} 
      description={project.client?.name}
      className="max-w-6xl mx-auto"
      breadcrumbs={
        <div className="flex items-center gap-1 font-medium">
          <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{project.name}</span>
        </div>
      }
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {canManageProjects && (
            <>
              {(project as any).is_archived ? (
                <Button variant="outline" className="gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={async () => {
                  try {
                    const { unarchiveProject } = useProjectsStore.getState()
                    await unarchiveProject(project.id)
                    toast.success("Project unarchived")
                    loadData()
                  } catch (error) {
                    toast.error("Failed to unarchive project")
                  }
                }}>
                  <Archive className="h-4 w-4" />
                  Restore
                </Button>
              ) : (
                <Button variant="outline" className="gap-2" onClick={handleArchive}>
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the project
                      and all associated tasks and milestones.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 text-white">
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Edit Project</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Project</DialogTitle>
                    <DialogDescription>Update project details and budget.</DialogDescription>
                  </DialogHeader>
                  <ProjectForm 
                    project={project} 
                    onSuccess={() => {
                      setIsEditDialogOpen(false)
                      loadData()
                    }} 
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-lg font-bold mb-4">Project Overview</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {project.description || "No description provided for this project."}
            </p>
          </div>

          <Tabs defaultValue="milestones">
            <TabsList className="flex w-full overflow-x-auto gap-1 h-10 p-1">
              <TabsTrigger value="milestones" className="flex-shrink-0 text-[11px]">Roadmap</TabsTrigger>
              <TabsTrigger value="modules" className="flex-shrink-0 text-[11px]">Modules</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-shrink-0 text-[11px]">Backlog</TabsTrigger>
              {submission && (
                <TabsTrigger value="intake" className="flex-shrink-0 text-[11px]">Client Intake Info</TabsTrigger>
              )}
              <TabsTrigger value="activity" className="flex-shrink-0 text-[11px]">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="milestones" className="space-y-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Project Roadmap</h4>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Add Milestone
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Milestone</DialogTitle>
                    </DialogHeader>
                    <MilestoneForm 
                      projectId={project.id} 
                      onSuccess={() => loadData()} 
                    />
                  </DialogContent>
                </Dialog>
              </div>
              {milestones.length === 0 ? (
                <div className="text-center py-10 border rounded-lg border-dashed bg-muted/10">
                  <p className="text-sm text-muted-foreground italic">No milestones defined for the roadmap yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.map(m => (
                    <div 
                      key={m.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                        m.status === 'completed' && "bg-emerald-500/5 border-emerald-500/20"
                      )}
                      onClick={() => handleToggleMilestone(m)}
                    >
                      <div className="flex items-center gap-3">
                        {m.status === 'completed' ? (
                          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-muted" />
                        )}
                        <div>
                          <p className={cn("font-bold text-sm", m.status === 'completed' && "line-through text-muted-foreground")}>{m.title}</p>
                          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            Target: {m.due_date ? format(new Date(m.due_date), 'PPP') : 'No date'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>



            <TabsContent value="modules" className="pt-4">
              <ModulesTab projectId={project.id} canManage={canManageProjects} />
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Project Tasks
                  {tasks.length > 0 && (
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground/60 normal-case">
                      {tasks.filter(t => t.status === 'done').length}/{tasks.length} done
                    </span>
                  )}
                </h4>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Task</DialogTitle>
                    </DialogHeader>
                    <TaskForm 
                      task={{ project_id: project.id } as any} 
                      onSuccess={() => fetchTasks({ projectId: id })} 
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-12 border rounded-xl border-dashed bg-muted/10">
                  <Circle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground italic">No tasks yet. Create the first task above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div key={task.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border bg-card/50 hover:bg-card transition-all group",
                      task.status === 'done' && "opacity-60 bg-muted/20"
                    )}>
                      {/* Status toggle — click to complete/reopen */}
                      <button
                        onClick={async () => {
                          try {
                            await updateTask(task.id, { status: task.status === 'done' ? 'in_progress' : 'done' })
                          } catch (e: any) { toast.error(e.message) }
                        }}
                        className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                        title={task.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {task.status === 'done'
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          : <Circle className="h-5 w-5" />
                        }
                      </button>

                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold text-sm truncate",
                          task.status === 'done' && "line-through text-muted-foreground"
                        )}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={cn(
                            "text-[9px] h-4 uppercase",
                            task.priority === 'high' ? "text-rose-500 border-rose-500/30" :
                            task.priority === 'medium' ? "text-amber-500 border-amber-500/30" : "text-muted-foreground"
                          )}>{task.priority}</Badge>
                          {task.due_date && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />{task.due_date}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignee */}
                      {task.assignee && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignee?.avatar_url} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {task.assignee?.full_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[80px]">
                            {task.assignee?.full_name}
                          </span>
                        </div>
                      )}

                      {/* Delete — reveal on hover */}
                      {canManageProjects && (
                        <button
                          onClick={async () => {
                            try {
                              await deleteTask(task.id)
                              toast.success("Task deleted")
                            } catch (e: any) { toast.error(e.message) }
                          }}
                          className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-rose-500 transition-all"
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="activity" className="pt-4">
              <ScrollArea className="h-[500px] pr-2">
                <ActivityTimeline
                  entityId={project.id}
                  showEntityBadge={true}
                  limit={40}
                />
              </ScrollArea>
            </TabsContent>

            {submission && (
              <TabsContent value="intake" className="space-y-6 pt-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Onboarding Form Answers</h4>
                    <p className="text-[11px] text-muted-foreground">Original details submitted by {project.client?.name} through the intake portal.</p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 font-bold uppercase text-[9px] px-2.5 py-1 rounded-full">
                    Verified Intake
                  </Badge>
                </div>
                
                <div className="space-y-6">
                  {submission.template_sections?.map((section: any) => {
                    const answersMap = new Map(submission.answers?.map((a: any) => [a.field_id, a]) || [])
                    return (
                      <div key={section.id} className="rounded-xl border bg-card overflow-hidden">
                        <div className="px-5 py-3 bg-muted/40 border-b">
                          <h5 className="text-xs font-black text-foreground">{section.title}</h5>
                        </div>
                        <div className="divide-y divide-border/60">
                          {section.fields?.map((field: any) => {
                            let val = '—'
                            const answer = answersMap.get(field.id)
                            if (answer) {
                              if (field.is_sensitive && answer.answer_encrypted) {
                                try {
                                  val = atob(answer.answer_encrypted)
                                } catch (e) {
                                  val = '••••••••'
                                }
                              } else {
                                val = answer.answer_value || '—'
                              }
                            }
                            return (
                              <div key={field.id} className="px-5 py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <span className="text-xs font-bold text-muted-foreground">{field.label}</span>
                                <span className="text-xs font-semibold text-foreground sm:col-span-2 leading-relaxed whitespace-pre-wrap">
                                  {val}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <ProjectHealthCard project={project} />
          <ProjectProfitabilityCard project={project} />

          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h3 className="font-bold">Project Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{project.type}</Badge>
                </span>
                <span className="font-bold text-primary">{project.status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Start Date
                </span>
                <span className="font-medium">{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Deadline
                </span>
                <span className="font-medium">{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'N/A'}</span>
              </div>
              {canManageProjects && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" /> Budget
                  </span>
                  <span className="font-bold text-emerald-500">₹{project.budget?.toLocaleString('en-IN') || '0'}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Lead
                </span>
                <span className="font-medium">{project.lead?.full_name || 'Unassigned'}</span>
              </div>
              {project.department_id && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" /> Dept
                  </span>
                  <span className="font-medium">
                    {departments.find(d => d.id === project.department_id)?.name || 'All Departments'}
                  </span>
                </div>
              )}
            </div>
            
            <Button variant="secondary" className="w-full gap-2 text-xs h-8">
              <FileText className="h-3 w-3" />
              View Gantt Timeline
            </Button>
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Overall Progress</span>
                <span>{(() => {
                  if (tasks.length === 0) return "0%"
                  const completed = tasks.filter(t => t.status === 'done').length
                  return `${Math.round((completed / tasks.length) * 100)}%`
                })()}</span>
              </div>
              <Progress 
                value={tasks.length === 0 ? 0 : (tasks.filter(t => t.status === 'done').length / tasks.length) * 100} 
                className="h-2" 
              />
              <p className="text-[10px] text-muted-foreground">
                {tasks?.length > 0 ? `${tasks.filter(t => t.status === 'done').length} of ${tasks.length} tasks completed` : "No tasks loaded"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
