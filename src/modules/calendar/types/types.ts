export type CalendarEventType = 'project' | 'task' | 'milestone' | 'meeting' | 'leave'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: CalendarEventType
  status?: string
  description?: string
  color?: string
  metadata?: any
}
