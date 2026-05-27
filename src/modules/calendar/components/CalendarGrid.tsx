import React, { useState } from 'react'
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../types'

interface CalendarGridProps {
  events: CalendarEvent[]
  isLoading?: boolean
  onEventClick?: (event: CalendarEvent) => void
}

export function CalendarGrid({ events, isLoading, onEventClick }: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate
  })

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.start), day))
  }

  return (
    <div className="bg-card/30 backdrop-blur-xl border rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-6 border-b bg-muted/20">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
              {events.length} Events Scheduled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-9 font-bold" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 border-b bg-muted/10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1">
        {calendarDays.map((day, idx) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, monthStart)
          
          return (
            <div 
              key={idx}
              className={cn(
                "min-h-[120px] border-r border-b p-2 transition-colors relative group",
                !isCurrentMonth ? "bg-muted/5 opacity-40" : "bg-transparent hover:bg-muted/10",
                isToday(day) && "bg-primary/5"
              )}
            >
              <div className={cn(
                "text-xs font-black h-6 w-6 flex items-center justify-center rounded-lg mb-1",
                isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}>
                {format(day, 'd')}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                {dayEvents.map(event => (
                  <div 
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold truncate border flex items-center gap-1.5 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer",
                      event.type === 'project' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                      event.type === 'task' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      event.type === 'milestone' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    )}
                  >
                    <div className={cn("h-1.5 w-1.5 rounded-full", 
                      event.type === 'project' ? "bg-blue-500" :
                      event.type === 'task' ? "bg-amber-500" :
                      event.type === 'milestone' ? "bg-purple-500" :
                      "bg-emerald-500"
                    )} />
                    {event.title}
                  </div>
                ))}
              </div>

              {dayEvents.length > 3 && (
                <div className="absolute bottom-1 right-2 text-[8px] font-black uppercase text-primary">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
