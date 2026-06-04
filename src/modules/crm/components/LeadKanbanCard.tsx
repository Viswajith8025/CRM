import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, DollarSign, Building2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Contact as Lead } from '../types'
import { format } from 'date-fns'

interface LeadKanbanCardProps {
  lead: Lead
  isOverlay?: boolean
  isSyncing?: boolean
  onEdit?: (lead: Lead) => void
  onViewDetails?: (lead: Lead) => void
}

export function LeadKanbanCard({ lead, isOverlay, isSyncing, onEdit, onViewDetails }: LeadKanbanCardProps) {
  const isConverted = lead.status === 'active_client'

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    disabled: isConverted,
    data: {
      type: 'Lead',
      lead,
    },
  })

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  }

  const initials = `${lead.first_name[0]}${lead.last_name ? lead.last_name[0] : ''}`.toUpperCase()

  const cardContent = (
    <Card 
      className={cn(
        "p-4 transition-all group relative",
        isConverted ? "cursor-default opacity-80" : "cursor-grab active:cursor-grabbing hover:border-primary/50",
        isDragging && "opacity-50",
        isOverlay && "cursor-grabbing border-primary shadow-xl scale-105 rotate-2",
        isSyncing && "animate-pulse border-primary/30"
      )}
      onDoubleClick={() => onViewDetails?.(lead)}
    >
      {onEdit && (
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
          className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 bg-background hover:bg-muted text-muted-foreground transition-all z-10 shadow-sm border border-border/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
      )}
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold truncate max-w-[120px]">
                {lead.first_name} {lead.last_name}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Building2 className="h-2.5 w-2.5" />
                {lead.company || "No Company"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {lead.value && (
            <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
              <span className="text-[10px] font-black mr-0.5">₹</span>
              {lead.value.toLocaleString()}
            </Badge>
          )}
        </div>

        {lead.next_follow_up && (
          <div className="pt-2 border-t flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
              <Calendar className="h-3 w-3" />
              {format(new Date(lead.next_follow_up), 'MMM d')}
            </div>
            <div className="flex -space-x-1">
              <div className="h-4 w-4 rounded-full border border-background bg-muted flex items-center justify-center">
                 <Star className="h-2 w-2 text-amber-500 fill-amber-500" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )

  if (isOverlay) return cardContent

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {cardContent}
    </div>
  )
}
