import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Contact as Lead, LeadStatus } from '../types'
import { LeadKanbanCard } from './LeadKanbanCard'
import { cn } from '@/lib/utils'

interface LeadKanbanColumnProps {
  id: LeadStatus
  title: string
  leads: Lead[]
  syncingLeadId?: string | null
  onEdit?: (lead: Lead) => void
  onViewDetails?: (lead: Lead) => void
}

export function LeadKanbanColumn({ id, title, leads, syncingLeadId, onEdit, onViewDetails }: LeadKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div className="flex flex-col w-[85vw] sm:w-72 shrink-0 snap-center">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">
            {title}
          </h3>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-black">
            {leads.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-3 rounded-xl p-3 bg-muted/30 border-2 border-transparent transition-colors min-h-[500px]",
          isOver && "bg-muted/50 border-primary/20 border-dashed"
        )}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadKanbanCard 
              key={lead.id} 
              lead={lead} 
              isSyncing={syncingLeadId === lead.id}
              onEdit={onEdit}
              onViewDetails={onViewDetails}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
