import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Calendar, Loader2, MoreHorizontal, Edit2, Trash2, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  DialogDescription,
} from "@/components/ui/dialog"
import { useState, useCallback, memo } from "react"
import { useTasksStore } from "../tasksStore"
import { toast } from "sonner"

const priorityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500",
  medium: "bg-amber-500/10 text-amber-500",
  high: "bg-rose-500/10 text-rose-500",
  urgent: "bg-red-600 text-white",
}

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
  isSyncing?: boolean
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onOpenDetails: (task: Task) => void
}

const TaskCard = memo(({ task, isOverlay, isSyncing, onEdit, onDelete, onOpenDetails }: TaskCardProps) => {
  const { deleteTask } = useTasksStore()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const handleDelete = async () => {
    try {
      await deleteTask(task.id)
      toast.success("Task deleted")
    } catch (error) {
      toast.error("Failed to delete task")
    }
  }


  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Only open details if not clicking on the dropdown or buttons
    if ((e.target as HTMLElement).closest('button')) return
    onOpenDetails(task)
  }, [task, onOpenDetails])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border/50 bg-card p-4 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 grayscale",
        isOverlay && "shadow-xl border-primary ring-2 ring-primary/20 rotate-2 scale-105",
        isSyncing && "opacity-70 pointer-events-none cursor-wait border-primary/50 bg-primary/5 animate-pulse"
      )}
    >
      {isSyncing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/20 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <div className="flex items-start justify-between">
        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", priorityColors[task.priority])}>
          {task.priority}
        </Badge>
        
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(task)} className="gap-2">
                <Edit2 className="h-3 w-3" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-bold" 
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {task.assignee && (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee?.avatar_url} />
              <AvatarFallback>{task.assignee?.full_name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {task.title}
          </h4>
        </div>
        
        <div className="flex flex-col gap-1">
          {task.project && (
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight truncate">
                {task.project.name}
              </p>
            </div>
          )}
          
          {task.assignee && (
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                Lead: <span className="text-foreground font-bold">{task.assignee?.full_name || "Unknown"}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-3 text-muted-foreground">
          {task.comments && task.comments[0]?.count > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-bold">
              <MessageSquare className="h-3 w-3" />
              <span>{task.comments[0].count}</span>
            </div>
          )}
        </div>
        
        {task.due_date && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-accent px-2 py-0.5 rounded">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(task.due_date), 'MMM d')}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default TaskCard
