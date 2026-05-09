import { create } from 'zustand'
import type { CalendarEvent } from '../types/types'
import { supabase } from '@/lib/supabase'

interface CalendarState {
  events: CalendarEvent[]
  isLoading: boolean
  fetchEvents: () => Promise<void>
}

export const useCalendarStore = create<CalendarState>((set) => ({
  events: [],
  isLoading: false,
  fetchEvents: async () => {
    set({ isLoading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Helper to fetch and handle errors (e.g. table not found)
      const safeFetch = async (query: any) => {
        try {
          const res = await query
          return res
        } catch (e) {
          console.warn('Calendar query suppressed:', e)
          return { data: null, error: e }
        }
      }

      // Fetch in parallel but handle individual failures
      const [projectsRes, tasksRes, milestonesRes, leavesRes] = await Promise.all([
        safeFetch(supabase.from('projects').select('*')),
        safeFetch(supabase.from('tasks').select('*')),
        safeFetch(supabase.from('project_milestones').select('*')),
        safeFetch(supabase.from('hr_leaves').select('*, profiles:user_id(full_name)'))
      ])

      const allEvents: CalendarEvent[] = []

      // Map Projects
      projectsRes.data?.forEach(p => {
        if (p.start_date) {
          allEvents.push({
            id: p.id,
            title: `Proj: ${p.name}`,
            start: new Date(p.start_date),
            end: p.end_date ? new Date(p.end_date) : new Date(p.start_date),
            type: 'project',
            status: p.status,
            color: 'bg-blue-500'
          })
        }
      })

      // Map Tasks
      tasksRes.data?.forEach(t => {
        if (t.due_date) {
          allEvents.push({
            id: t.id,
            title: `Task: ${t.title}`,
            start: new Date(t.due_date),
            end: new Date(t.due_date),
            type: 'task',
            status: t.status,
            color: t.priority === 'high' ? 'bg-rose-500' : 'bg-amber-500'
          })
        }
      })

      // Map Milestones
      milestonesRes.data?.forEach(m => {
        if (m.due_date) {
          allEvents.push({
            id: m.id,
            title: `MS: ${m.title}`,
            start: new Date(m.due_date),
            end: new Date(m.due_date),
            type: 'milestone',
            status: m.status,
            color: 'bg-purple-500'
          })
        }
      })

      // Map Leaves (Safe check for relationship data)
      leavesRes?.data?.forEach(l => {
        if (l.start_date) {
          const profileName = (l.profiles as any)?.full_name || 'Staff'
          allEvents.push({
            id: l.id,
            title: `Leave: ${profileName}`,
            start: new Date(l.start_date),
            end: l.end_date ? new Date(l.end_date) : new Date(l.start_date),
            type: 'leave',
            status: l.status,
            color: 'bg-slate-500'
          })
        }
      })

      set({ events: allEvents, isLoading: false })
    } catch (err) {
      console.error("Failed to fetch calendar events:", err)
      set({ isLoading: false })
    }
  }
}))

