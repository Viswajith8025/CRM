import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Project, ProjectStatus } from '../types'
import ProjectCard from './ProjectCard'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  id: ProjectStatus
  title: string
  projects: Project[]
  syncingProjectId: string | null
}

export function KanbanColumn({ id, title, projects, syncingProjectId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div className="flex flex-col w-[350px] shrink-0">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{title}</h3>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-500 border border-slate-200">
            {projects.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-4 p-2 rounded-2xl transition-colors duration-200 min-h-[500px]",
          isOver ? "bg-slate-100/50 ring-2 ring-slate-200/50 ring-inset" : "bg-transparent"
        )}
      >
        <SortableContext
          id={id}
          items={projects.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              isDraggable 
              isSyncing={syncingProjectId === project.id}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
