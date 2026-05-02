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
}

export function LeadKanbanCard({ lead, isOverlay, isSyncing }: LeadKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
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
    <Card className={cn(
      "p-4 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all group",
      isDragging && "opacity-50",
      isOverlay && "cursor-grabbing border-primary shadow-xl scale-105 rotate-2",
      isSyncing && "animate-pulse border-primary/30"
    )}>
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
          <Badge variant="secondary" className="text-[9px] font-black h-5">
            {lead.score}/100
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[9px] h-4 uppercase tracking-tighter">
            {lead.segment}
          </Badge>
          {lead.value && (
            <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
              <DollarSign className="h-2 w-2 mr-0.5" />
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
