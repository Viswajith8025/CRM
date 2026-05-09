import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
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
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CommentSection } from "@/components/shared/comments/CommentSection"
import { ProjectHealthCard } from "../components/ProjectHealthCard"
import { ProjectProfitabilityCard } from "../components/ProjectProfitabilityCard"

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
  const { tasks, fetchTasks, subscribeToTasks } = useTasksStore()
  const { getProjectById, fetchMilestones, updateProject, deleteProject, updateMilestone, fetchSprints, sprints } = useProjectsStore()
  const { profile } = useAuthStore()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const isEmployee = profile?.role === 'employee'
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const projectSprints = id ? sprints[id] || [] : []

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
  }

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToTasks() // Pass no ID to use the store's current project context if needed, or update store to support id
    return () => unsubscribe()
  }, [id])

  const handleArchive = async () => {
    if (!project) return
    try {
      await updateProject(project.id, { status: 'on_hold' })
      toast.success("Project archived")
      loadData()
    } catch (error) {
      toast.error("Failed to archive project")
    }
  }

  const handleDelete = async () => {
    if (!project) return
    try {
      await deleteProject(project.id)
      toast.success("Project deleted")
      navigate('/projects')
    } catch (error) {
      toast.error("Failed to delete project")
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

          {!isEmployee && (
            <>
              <Button variant="outline" className="gap-2" onClick={handleArchive}>
                <Archive className="h-4 w-4" />
                Archive
              </Button>

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
            <p className="text-muted-foreground leading-relaxed">
              {project.description || "No description provided for this project."}
            </p>
          </div>

          <Tabs defaultValue="milestones">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="milestones">Roadmap</TabsTrigger>
              <TabsTrigger value="sprints">Sprints</TabsTrigger>
              <TabsTrigger value="tasks">Backlog</TabsTrigger>
              <TabsTrigger value="team">Resource</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="chat">Discussions</TabsTrigger>
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

            <TabsContent value="sprints" className="space-y-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active & Planned Sprints</h4>
                <Button size="sm" className="h-8 gap-2" variant="outline">
                  <Plus className="h-3.5 w-3.5" />
                  New Sprint
                </Button>
              </div>
              {projectSprints.length === 0 ? (
                <div className="text-center py-10 border rounded-lg border-dashed bg-muted/10">
                  <p className="text-sm text-muted-foreground italic">No sprints planned. Start an Agile sprint to track velocity.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projectSprints.map(sprint => (
                    <div key={sprint.id} className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-bold">{sprint.name}</h5>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sprint.start_date), 'MMM d')} - {format(new Date(sprint.end_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge variant={sprint.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                          {sprint.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                          <span>Sprint Progress</span>
                          <span>{sprint.status === 'completed' ? '100%' : '0%'}</span>
                        </div>
                        <Progress value={sprint.status === 'completed' ? 100 : 0} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="tasks" className="space-y-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Project Tasks</h4>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8">Add Task</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Task</DialogTitle>
                    </DialogHeader>
                    <TaskForm 
                      task={{ project_id: project.id } as any} 
                      onSuccess={() => loadData()} 
                    />
                  </DialogContent>
                </Dialog>
              </div>
              {tasks.length === 0 ? (
                <div className="text-center py-10 border rounded-lg border-dashed">
                  No tasks created for this project.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold",
                          task.status === 'done' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        )}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <div>
                          <p className="font-bold text-sm">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[9px] h-4">
                              {task.priority}
                            </Badge>
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {task.due_date}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {task.assignee && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{task.assignee?.full_name || "Unknown"}</span>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={task.assignee?.avatar_url} />
                            <AvatarFallback>{task.assignee?.full_name?.charAt(0) || "U"}</AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="team" className="space-y-4 pt-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Project Team</h4>
              
              {project.lead && (
                <div className="mb-6">
                  <h5 className="text-xs font-bold text-primary uppercase mb-2">Team Lead</h5>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-primary text-primary-foreground">{project.lead?.full_name?.charAt(0) || "L"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm">{project.lead?.full_name || "Unassigned"}</p>
                      <p className="text-xs text-muted-foreground">{project.lead?.email || "No email"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Team Members</h5>
                {(!project.members || project.members.filter(m => m.role === 'member').length === 0) ? (
                  <div className="text-center py-6 border rounded-lg border-dashed">
                    No additional team members assigned.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {project.members.filter(m => m.role === 'member').map(member => (
                      <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                          <AvatarFallback>{member.profiles?.full_name?.charAt(0) || "M"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm">{member.profiles?.full_name || "Unknown Member"}</p>
                          <p className="text-xs text-muted-foreground">{member.profiles?.email || "No email"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Project Assets</h4>
                <FileUploadZone 
                  relatedId={project.id}
                  relatedType="project"
                  bucket="documents"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Files</h4>
                <AttachmentList 
                  relatedId={project.id}
                  relatedType="project"
                />
              </div>
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

            <TabsContent value="chat" className="pt-4 h-[600px]">
              <CommentSection entityId={project.id} entityType="project" />
            </TabsContent>
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
              {!isEmployee && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Budget
                  </span>
                  <span className="font-bold text-emerald-500">${project.budget?.toLocaleString() || '0'}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Lead
                </span>
                <span className="font-medium">{project.lead?.full_name || 'Unassigned'}</span>
              </div>
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
