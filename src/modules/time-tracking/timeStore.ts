import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { TimeLog, ActiveTimer } from './types'
import { differenceInMinutes } from 'date-fns'

interface TimeState {
  logs: TimeLog[]
  activeTimer: ActiveTimer | null
  isLoading: boolean
  error: string | null
  fetchLogs: () => Promise<void>
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

  fetchLogs: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .select('*, task:tasks(title, project:projects(name))')
        .order('start_time', { ascending: false })
      
      if (error) throw error
      set({ logs: data as TimeLog[], error: null })
    } catch (err: any) {
      set({ error: err.message })
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
          task_id: activeTimer.task_id,
          description: activeTimer.description,
          start_time: activeTimer.start_time,
          end_time,
          duration_minutes,
          is_billable: activeTimer.is_billable
        })
        .select('*, task:tasks(title, project:projects(name))')
        .single()

      if (error) throw error
      set({ 
        logs: [data as TimeLog, ...get().logs],
        activeTimer: null 
      })
      localStorage.removeItem('active_timer')
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  addManualLog: async (log) => {
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .insert(log)
        .select('*, task:tasks(title, project:projects(name))')
        .single()
      
      if (error) throw error
      set({ logs: [data as TimeLog, ...get().logs] })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  deleteLog: async (id) => {
    try {
      const { error } = await supabase.from('time_logs').delete().eq('id', id)
      if (error) throw error
      set({ logs: get().logs.filter(l => l.id !== id) })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  }
}))
