import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Layout, MoreHorizontal, Edit2, Trash2, Eye, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Project } from "../types"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProjectForm } from "./ProjectForm"
import { toast } from "sonner"
import { useProjectsStore } from "../projectsStore"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState } from "react"

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/10 text-blue-500",
  in_progress: "bg-emerald-500/10 text-emerald-500",
  on_hold: "bg-amber-500/10 text-amber-500",
  completed: "bg-purple-500/10 text-purple-500",
  cancelled: "bg-rose-500/10 text-rose-500",
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const { deleteProject, updateProject } = useProjectsStore()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updateProject(project.id, { status: 'on_hold' })
      toast.success("Project archived (set to On Hold)")
    } catch (error) {
      toast.error("Failed to archive project")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteProject(project.id)
      toast.success("Project deleted successfully")
    } catch (error) {
      toast.error("Failed to delete project")
    }
  }

  return (
    <>
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border-border/50"
        onClick={() => navigate(`/projects/${project.id}`)}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={cn(statusColors[project.status])}>
              {project.status.replace('_', ' ')}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)} className="gap-2">
                  <Eye className="h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="gap-2">
                  <Edit2 className="h-4 w-4" /> Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive} className="gap-2">
                  <Archive className="h-4 w-4" /> Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-bold" 
                  onClick={() => setIsDeleteAlertOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardTitle className="mt-2 text-xl font-bold group-hover:text-primary transition-colors">
            {project.name}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {project.client?.name || "No Client Assigned"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'No deadline'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              <span>{project.task_stats?.completed || 0}/{project.task_stats?.total || 0} Tasks</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>Progress</span>
              <span>{(() => {
                const total = project.task_stats?.total || 0
                const completed = project.task_stats?.completed || 0
                if (total === 0) return "0%"
                return `${Math.round((completed / total) * 100)}%`
              })()}</span>
            </div>
            <Progress 
              value={project.task_stats?.total ? (project.task_stats.completed / project.task_stats.total) * 100 : 0} 
              className="h-1.5" 
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center -space-x-2">
              {project.members && project.members.length > 0 ? (
                project.members.filter(m => m.role === 'member').slice(0, 3).map((member) => (
                  <Avatar key={member.user_id} className="h-7 w-7 border-2 border-background ring-1 ring-border/50">
                    <AvatarFallback className="bg-muted text-[10px] font-bold">
                      {member.profiles.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">?</span>
                </div>
              )}
              {project.members && project.members.filter(m => m.role === 'member').length > 3 && (
                <div className="h-7 w-7 rounded-full bg-accent border-2 border-background flex items-center justify-center text-[8px] font-black">
                  +{project.members.filter(m => m.role === 'member').length - 3}
                </div>
              )}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
              <span className="opacity-50 font-normal block text-[8px]">Team Lead</span>
              {project.lead?.full_name || "Unassigned"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <ProjectForm project={project} onSuccess={() => setIsEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project "{project.name}" and all associated tasks and milestones.
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
    </>
  )
}
