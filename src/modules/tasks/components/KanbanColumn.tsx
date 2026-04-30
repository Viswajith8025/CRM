import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '../types'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  syncingTaskId: string | null
}

export function KanbanColumn({ id, title, tasks, syncingTaskId }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: id,
  })

  return (
    <div className="flex flex-col w-80 shrink-0 bg-muted/30 rounded-xl border border-border/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm tracking-tight">{title}</h3>
        <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 flex flex-col gap-3 min-h-[500px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              isSyncing={syncingTaskId === task.id}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
