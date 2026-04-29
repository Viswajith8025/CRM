import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task } from '../types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Calendar, Paperclip, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const priorityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500",
  medium: "bg-amber-500/10 text-amber-500",
  high: "bg-rose-500/10 text-rose-500",
  urgent: "bg-red-600 text-white",
}

interface TaskCardProps {
  task: Task
  isOverlay?: boolean
}

export function TaskCard({ task, isOverlay }: TaskCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border/50 bg-card p-4 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 grayscale",
        isOverlay && "shadow-xl border-primary ring-2 ring-primary/20 rotate-2 scale-105"
      )}
    >
      <div className="flex items-start justify-between">
        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", priorityColors[task.priority])}>
          {task.priority}
        </Badge>
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.avatar_url} />
            <AvatarFallback>{task.assignee.full_name.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">
          {task.title}
        </h4>
        {task.project && (
          <p className="text-[10px] font-medium text-muted-foreground uppercase">
            {task.project.name}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex items-center gap-1 text-[10px] font-medium">
            <MessageSquare className="h-3 w-3" />
            <span>2</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-medium">
            <Paperclip className="h-3 w-3" />
            <span>1</span>
          </div>
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
}
