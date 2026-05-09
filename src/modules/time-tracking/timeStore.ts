import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { TimeLog, ActiveTimer } from '../types/types'
import { differenceInMinutes } from 'date-fns'

interface TimeState {
  logs: TimeLog[]
  activeTimer: ActiveTimer | null
  isLoading: boolean
  hasFetched: boolean
  error: string | null
  fetchLogs: (force?: boolean) => Promise<void>
  startTimer: (timer: ActiveTimer) => void
  stopTimer: () => Promise<void>
  addManualLog: (log: Partial<TimeLog>) => Promise<void>
  deleteLog: (id: string) => Promise<void>
  markLogsAsBilled: (logIds: string[], invoiceId: string) => Promise<void>
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
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('time_logs')
        .select('*, task:tasks(title, project:projects(name))')
        .eq('organization_id', orgId)
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

    const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
    const orgId = profile?.organization_id
    if (!orgId) throw new Error("No organization context found.")

    const end_time = new Date().toISOString()
    const duration_minutes = differenceInMinutes(new Date(end_time), new Date(activeTimer.start_time))

    try {
      const { data, error } = await supabase
        .from('time_logs')
        .insert({
          organization_id: orgId,
          user_id: profile?.id,
          task_id: activeTimer.task_id || null,
          description: activeTimer.description,
          start_time: activeTimer.start_time,
          end_time,
          duration_minutes,
          is_billable: activeTimer.is_billable ?? true
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
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { 
        ...log, 
        organization_id: orgId, 
        user_id: profile?.id,
        task_id: log.task_id || null, 
        is_billable: log.is_billable ?? true 
      }

      const { data, error } = await supabase
        .from('time_logs')
        .insert(payload)
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
    set({ logs: previousLogs.filter(l => l.id !== id) })

    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('time_logs')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error
    } catch (err: any) {
      const friendlyError = toFriendlyError(err, "Failed to delete time log.")
      set({ logs: previousLogs, error: friendlyError.message })
      throw friendlyError
    }
  },

  markLogsAsBilled: async (logIds, invoiceId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('time_logs')
        .update({ is_billed: true, invoice_id: invoiceId })
        .in('id', logIds)
        .eq('organization_id', orgId)

      if (error) throw error

      set(state => ({
        logs: state.logs.map(log => 
          logIds.includes(log.id) ? { ...log, is_billed: true, invoice_id: invoiceId } : log
        )
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  }
}))

