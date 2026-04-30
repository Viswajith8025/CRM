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
  Trash2
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
import { useTasksStore } from "@/modules/tasks/tasksStore"
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
import { ProjectForm } from "../components/ProjectForm"
import { TaskForm } from "@/modules/tasks/components/TaskForm"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Project, Milestone } from "../types"
import { MilestoneForm } from "../components/MilestoneForm"
import { Skeleton } from "@/components/ui/skeleton"

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
  const { getProjectById, fetchMilestones, updateProject, deleteProject, updateMilestone } = useProjectsStore()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const loadData = async () => {
    if (!id) return
    const [projData, mileData] = await Promise.all([
      getProjectById(id),
      fetchMilestones(id),
      fetchTasks(id, true)
    ])
    setProject(projData)
    setMilestones(mileData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToTasks(id)
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
            <TabsList>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
            <TabsContent value="milestones" className="space-y-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Project Milestones</h4>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8">Add Milestone</Button>
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
                <div className="text-center py-10 border rounded-lg border-dashed">
                  No milestones defined yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.map(m => (
                    <div 
                      key={m.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                        m.is_completed && "bg-muted/30 border-muted"
                      )}
                      onClick={() => handleToggleMilestone(m)}
                    >
                      <div className="flex items-center gap-3">
                        {m.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className={cn("font-medium", m.is_completed && "line-through text-muted-foreground")}>{m.title}</p>
                          <p className="text-xs text-muted-foreground">Due: {m.due_date ? format(new Date(m.due_date), 'MMM d, yyyy') : 'No date'}</p>
                        </div>
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
                          <span className="text-xs font-medium">{task.assignee.full_name}</span>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={task.assignee.avatar_url} />
                            <AvatarFallback>{task.assignee.full_name.charAt(0)}</AvatarFallback>
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
                      <AvatarFallback className="bg-primary text-primary-foreground">{project.lead.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm">{project.lead.full_name}</p>
                      <p className="text-xs text-muted-foreground">{project.lead.email}</p>
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
                          <AvatarFallback>{member.profiles.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm">{member.profiles.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h3 className="font-bold">Project Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Deadline
                </span>
                <span className="font-medium">{project.end_date || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Budget
                </span>
                <span className="font-medium">${project.budget?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Manager
                </span>
                <span className="font-medium">Unassigned</span>
              </div>
            </div>
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
                {tasks.filter(t => t.status === 'done').length} of {tasks.length} tasks completed
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
