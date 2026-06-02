import React, { useState } from 'react'
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { MoreHorizontal, Edit2, Trash2, Eye, Archive, Calendar, Briefcase, Activity, AlertTriangle, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import ProjectForm from "./ProjectForm"
import { toast } from "sonner"
import { useProjectsStore } from "../projectsStore"
import { cn } from "@/lib/utils"
import type { Project } from "../types"

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/10 text-blue-500",
  in_progress: "bg-emerald-500/10 text-emerald-500",
  on_hold: "bg-amber-500/10 text-amber-500",
  completed: "bg-purple-500/10 text-purple-500",
  cancelled: "bg-rose-500/10 text-rose-500",
}

const healthColors: Record<string, string> = {
  'on-track': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'at-risk': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  'delayed': 'text-rose-500 bg-rose-500/10 border-rose-500/20',
}

const healthIcons: Record<string, any> = {
  'on-track': Activity,
  'at-risk': TrendingUp,
  'delayed': AlertTriangle,
}

interface ProjectListTableProps {
  projects: Project[]
}

export function ProjectListTable({ projects }: ProjectListTableProps) {
  const navigate = useNavigate()
  const { deleteProject, updateProject } = useProjectsStore()
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

  const handleArchive = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updateProject(project.id, { status: 'on_hold' })
      toast.success("Project archived (set to On Hold)")
    } catch (error) {
      toast.error("Failed to archive project")
    }
  }

  const handleDelete = async () => {
    if (!deletingProject) return
    try {
      await deleteProject(deletingProject.id)
      toast.success("Project deleted successfully")
      setDeletingProject(null)
    } catch (error) {
      toast.error("Failed to delete project")
    }
  }

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[800px]">
          <thead className="bg-slate-50/80 text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-500">PROJECT DETAILS</th>
              <th className="px-6 py-4 font-bold text-slate-500">CLIENT</th>
              <th className="px-6 py-4 font-bold text-slate-500">TEAM LEAD</th>
              <th className="px-6 py-4 font-bold text-slate-500">HEALTH</th>
              <th className="px-6 py-4 font-bold text-slate-500">STATUS</th>
              <th className="px-6 py-4 font-bold text-slate-500 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => (
              <tr 
                key={project.id} 
                className="group hover:bg-slate-50/80 transition-colors cursor-pointer bg-white"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {/* Project Details */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-sky-600 text-base">{project.name}</span>
                    <div className="flex items-center text-xs text-slate-400 gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'No deadline'}
                    </div>
                  </div>
                </td>

                {/* Client */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <Briefcase className="h-4 w-4 text-slate-300" />
                    {project.client?.name || "No Client Assigned"}
                  </div>
                </td>

                {/* Team Lead */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm border border-slate-100">
                      <AvatarImage src={project.lead?.avatar_url} />
                      <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-xs">
                        {project.lead?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-slate-700 text-sm">
                      {project.lead?.full_name || "Unassigned"}
                    </span>
                  </div>
                </td>

                {/* Health */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {project.health ? (
                    <Badge variant="outline" className={cn("gap-1 font-bold rounded-full px-3 py-0.5", healthColors[project.health.status])}>
                      {React.createElement(healthIcons[project.health.status], { className: "h-3.5 w-3.5" })}
                      <span className="capitalize">{project.health.status.replace('-', ' ')}</span>
                    </Badge>
                  ) : (
                    <span className="text-slate-300 text-xs font-medium">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="secondary" className={cn("rounded-full px-3 py-0.5 font-bold capitalize shadow-sm", statusColors[project.status])}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)} className="gap-2">
                        <Eye className="h-4 w-4 text-slate-400" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingProject(project)} className="gap-2">
                        <Edit2 className="h-4 w-4 text-slate-400" /> Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleArchive(project, e)} className="gap-2">
                        <Archive className="h-4 w-4 text-slate-400" /> Archive
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-bold" 
                        onClick={() => setDeletingProject(project)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <ProjectForm project={editingProject} onSuccess={() => setEditingProject(null)} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project "{deletingProject?.name}" and all associated tasks and milestones.
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
    </div>
  )
}
