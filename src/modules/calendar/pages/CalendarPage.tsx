import React, { useEffect } from 'react'
import { PageWrapper } from '@/components/shared/PageWrapper'
import { CalendarGrid } from '../components/CalendarGrid'
import { useCalendarStore } from '../calendarStore'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Briefcase, 
  CheckSquare, 
  Milestone, 
  UserX, 
  Info,
  Calendar as CalendarIcon,
  Clock,
  AlignLeft,
  X
} from 'lucide-react'

import { format } from 'date-fns'
import type { CalendarEvent } from '../types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function CalendarPage() {
  const { events, fetchEvents, isLoading } = useCalendarStore()
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return (
    <PageWrapper 
      title="Company Scheduler" 
      description="Visual timeline of projects, deadlines, and team availability."
    >
      <div className="grid gap-6 lg:grid-cols-4 h-[calc(100vh-200px)]">
        {/* Left Sidebar: Filters & Legend */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 bg-card/30 backdrop-blur-xl border-border/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Event Legend</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-bold">Projects</span>
                </div>
                <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/10">
                  {events.filter(e => e.type === 'project').length}
                </Badge>
              </div>

              <div className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <CheckSquare className="h-4 w-4 text-amber-500" />
                  </div>
                  <span className="text-sm font-bold">Deadlines</span>
                </div>
                <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/10">
                  {events.filter(e => e.type === 'task').length}
                </Badge>
              </div>

              <div className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Milestone className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="text-sm font-bold">Milestones</span>
                </div>
                <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/10">
                  {events.filter(e => e.type === 'milestone').length}
                </Badge>
              </div>

              <div className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <UserX className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-sm font-bold">Leave / Absence</span>
                </div>
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/10">
                  {events.filter(e => e.type === 'leave').length}
                </Badge>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex gap-3">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Events are automatically synced from the CRM, Projects, and HR modules. Click an event to view details.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/30 backdrop-blur-xl border-border/50">
             <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Upcoming This Week</h3>
             <div className="space-y-4">
                {events
                  .filter(e => {
                    const d = new Date(e.start)
                    const now = new Date()
                    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    return diff >= 0 && diff <= 7
                  })
                  .slice(0, 5)
                  .map(event => (
                    <div key={event.id} className="flex gap-3 items-start">
                      <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", 
                        event.type === 'project' ? "bg-blue-500" :
                        event.type === 'task' ? "bg-amber-500" :
                        event.type === 'milestone' ? "bg-purple-500" :
                        "bg-emerald-500"
                      )} />
                      <div>
                        <p className="text-xs font-bold leading-tight">{event.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(event.start), 'EEE, MMM d')}</p>
                      </div>
                    </div>
                  ))
                }
                {events.length === 0 && <p className="text-xs text-muted-foreground italic">No events this week.</p>}
             </div>
          </Card>
        </div>

        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <CalendarGrid events={events} isLoading={isLoading} onEventClick={setSelectedEvent} />
        </div>
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-[425px] border-border/50 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
          <div className={cn("h-2 w-full", 
              selectedEvent?.type === 'project' ? "bg-blue-500" :
              selectedEvent?.type === 'task' ? "bg-amber-500" :
              selectedEvent?.type === 'milestone' ? "bg-purple-500" :
              "bg-emerald-500"
            )} 
          />
          <div className="p-6 pt-5">
            <DialogHeader className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <DialogTitle className="text-xl font-black tracking-tight leading-tight">
                  {selectedEvent?.title}
                </DialogTitle>
                <Badge variant="outline" className={cn(
                  "uppercase font-black text-[9px] shrink-0",
                  selectedEvent?.type === 'project' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                  selectedEvent?.type === 'task' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                  selectedEvent?.type === 'milestone' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                )}>
                  {selectedEvent?.type}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex items-center gap-3 text-sm">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center border border-border/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date & Time</p>
                  <p className="font-semibold text-foreground">
                    {selectedEvent && format(new Date(selectedEvent.start), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              {selectedEvent?.description && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center border border-border/50 shrink-0">
                    <AlignLeft className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Details</p>
                    <p className="font-medium text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedEvent.description}
                    </p>
                  </div>
                </div>
              )}

              {selectedEvent?.status && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center border border-border/50">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Status</p>
                    <Badge variant="secondary" className="mt-1 font-bold capitalize">
                      {selectedEvent.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-border/50 flex justify-end">
              <Button onClick={() => setSelectedEvent(null)} className="font-bold">
                Close Details
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}


