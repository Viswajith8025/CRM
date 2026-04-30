import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { TimeLog, ActiveTimer } from './types'
import { differenceInMinutes } from 'date-fns'

interface TimeState {
  logs: TimeLog[]
  activeTimer: ActiveTimer | null
  isLoading: boolean
  hasFetched: boolean
  fetchLogs: (force?: boolean) => Promise<void>
  startTimer: (timer: ActiveTimer) => void
  stopTimer: () => Promise<void>
  addManualLog: (log: Partial<TimeLog>) => Promise<void>
  deleteLog: (id: string) => Promise<void>
}

export const useTimeStore = create<TimeState>((set, get) => ({
  logs: [],
  activeTimer: null,
  isLoading: false,
  error: null,
  hasFetched: false,
  
  fetchLogs: async (force = false) => {
    if (!force && get().hasFetched) return;
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .select('*, task:tasks(title, project:projects(name))')
        .order('start_time', { ascending: false })

      if (error) throw error
      set({ logs: data as TimeLog[], error: null, hasFetched: true })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load time logs.") })
    } finally {
      set({ isLoading: false })
    }
  },

  startTimer: (timer) => {
    set({ activeTimer: timer })
    localStorage.setItem('active_timer', JSON.stringify(timer))
  },

  stopTimer: async () => {
    const { activeTimer } = get()
    if (!activeTimer) return

    const end_time = new Date().toISOString()
    const duration_minutes = differenceInMinutes(new Date(end_time), new Date(activeTimer.start_time))

    try {
      const { data, error } = await supabase
        .from('time_logs')
        .insert({
          task_id: activeTimer.task_id || null, // Ensure empty strings become null
          description: activeTimer.description,
          start_time: activeTimer.start_time,
          end_time,
          duration_minutes
          // Removed is_billable as it's not in the current time_logs schema
        })
        .select('*, task:tasks(title, project:projects(name))')
        .single()

      if (error) throw error
      set({
        logs: [data as TimeLog, ...get().logs],
        activeTimer: null
      })
      localStorage.removeItem('active_timer')
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to stop timer.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  addManualLog: async (log) => {
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .insert({
          ...log,
          task_id: log.task_id || null, // Ensure empty string becomes null
          is_billable: undefined // Strip unsupported property before sending to DB
        })
        .select('*, task:tasks(title, project:projects(name))')
        .single()

      if (error) throw error
      set({ logs: [data as TimeLog, ...get().logs] })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to log time.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteLog: async (id) => {
    const previousLogs = get().logs
    // Optimistic UI update
    set({ logs: previousLogs.filter(l => l.id !== id) })

    try {
      const { error } = await supabase.from('time_logs').delete().eq('id', id)
      if (error) throw error
    } catch (err: any) {
      // Rollback
      const friendlyError = toFriendlyError(err, "Failed to delete time log.")
      set({ logs: previousLogs, error: friendlyError.message })
      throw friendlyError
    }
  }
}))
