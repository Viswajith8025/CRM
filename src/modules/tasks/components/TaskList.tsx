import { format } from "date-fns"
import { MoreVertical, Calendar, User, Briefcase, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Task } from "../types/types"
import { useTasksStore } from "../tasksStore"
import TaskDetailsDialog from "./TaskDetailsDialog"
import { useState, memo } from "react"
import { toast } from "sonner"

interface TaskListProps {
  tasks: Task[]
}

export const TaskList = memo(({ tasks }: TaskListProps) => {
  const { deleteTask, pagination, fetchTasks } = useTasksStore()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/50'
      case 'high': return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50'
      case 'medium': return 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50'
      default: return 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-900/30 dark:border-slate-800/50'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'text-emerald-600 bg-emerald-50'
      case 'review': return 'text-purple-600 bg-purple-50'
      case 'in_progress': return 'text-blue-600 bg-blue-50'
      default: return 'text-slate-600 bg-slate-50'
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Task Details</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assignee</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Clock className="h-8 w-8" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No matching tasks found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr 
                    key={task.id} 
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedTask(task)}
                  >
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">{task.title}</p>
                        {task.due_date && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5 opacity-50" />
                        {task.project?.name || "No Project"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-background">
                          <AvatarImage src={task.assignee?.avatar_url || ""} />
                          <AvatarFallback className="text-[10px] font-bold">
                            {task.assignee?.full_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold">{task.assignee?.full_name || "Unassigned"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn("capitalize px-2 py-0 font-black text-[9px] tracking-widest", getPriorityColor(task.priority))}>
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className={cn("capitalize px-2 py-0 font-bold text-[10px]", getStatusColor(task.status))}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="font-medium">Edit Task</DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-rose-500 font-bold focus:text-rose-600 focus:bg-rose-50"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await deleteTask(task.id);
                                toast.success("Task deleted");
                              } catch (err: any) {
                                toast.error(err.message || "Failed to delete task");
                              }
                            }}
                          >
                            Delete Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-2 pt-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
          Showing <span className="text-foreground">{(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="text-foreground">{pagination.totalCount}</span> tasks
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.page === 1}
            onClick={() => fetchTasks({ page: pagination.page - 1 })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.page === pagination.totalPages}
            onClick={() => fetchTasks({ page: pagination.page + 1 })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Next
          </Button>
        </div>
      </div>

      <TaskDetailsDialog 
        task={selectedTask} 
        open={!!selectedTask} 
        onOpenChange={(open) => !open && setSelectedTask(null)} 
      />
    </div>
  )
})
