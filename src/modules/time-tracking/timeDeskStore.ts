import { create } from 'zustand'
// Workforce Intelligence Store v1.0
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { differenceInSeconds } from 'date-fns'

export type SessionStatus = 'active' | 'completed' | 'paused'
export type BreakType = 'lunch' | 'tea' | 'short_break' | 'personal' | 'meeting'

export interface WorkSession {
  id: string
  organization_id: string
  user_id: string
  start_time: string
  end_time: string | null
  status: SessionStatus
}

export interface BreakSession {
  id: string
  work_session_id: string
  start_time: string
  end_time: string | null
  type: BreakType
}

interface TimeDeskState {
  activeSession: WorkSession | null
  activeBreak: BreakSession | null
  isLoading: boolean
  isSyncing: boolean
  
  // Stats for the live clock
  workDuration: number // in seconds
  breakDuration: number // in seconds
  
  // Actions
  fetchActiveSession: () => Promise<void>
  checkIn: () => Promise<void>
  checkOut: () => Promise<void>
  startBreak: (type: BreakType) => Promise<void>
  endBreak: () => Promise<void>
  getSuggestedBreakType: () => BreakType
  
  // System
  syncLiveTimers: () => void
  processOfflineQueue: () => Promise<void>
}

export const useTimeDeskStore = create<TimeDeskState>((set, get) => ({
  activeSession: null,
  activeBreak: null,
  isLoading: false,
  isSyncing: false,
  workDuration: 0,
  breakDuration: 0,

  fetchActiveSession: async () => {
    set({ isLoading: true })
    try {
      // Process any stored offline queue once back online!
      if (navigator.onLine) {
        await get().processOfflineQueue()
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch active work session
      const { data: session, error: sError } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (sError) throw sError

      if (session) {
        // Fetch active break if any
        const { data: breakSess, error: bError } = await supabase
          .from('break_sessions')
          .select('*')
          .eq('work_session_id', session.id)
          .is('end_time', null)
          .maybeSingle()

        if (bError) throw bError
        set({ activeSession: session, activeBreak: breakSess })
        get().syncLiveTimers()
      } else {
        set({ activeSession: null, activeBreak: null, workDuration: 0, breakDuration: 0 })
      }
    } catch (err) {
      console.error('TimeDesk sync error:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  checkIn: async () => {
    set({ isSyncing: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user || !profile?.organization_id) return

      // Offline Intercept
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('vibe_timedesk_offline_queue') || '[]')
        queue.push({
          action: 'check_in',
          timestamp: new Date().toISOString(),
          payload: { orgId: profile.organization_id }
        })
        localStorage.setItem('vibe_timedesk_offline_queue', JSON.stringify(queue))

        set({
          activeSession: {
            id: 'offline-' + Date.now(),
            organization_id: profile.organization_id,
            user_id: user.id,
            start_time: new Date().toISOString(),
            end_time: null,
            status: 'active'
          },
          activeBreak: null
        })
        toast.info('Offline Mode: Shift started locally. Will synchronize once connection is restored.')
        return
      }

      const { data: sessionId, error } = await supabase.rpc('handle_check_in', {
        p_org_id: profile.organization_id,
        p_user_id: user.id
      })

      if (error) throw error
      
      // Fetch the full session object
      const { data: session } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      set({ activeSession: session, activeBreak: null })
      toast.success('Work session started. Good luck!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to check in')
    } finally {
      set({ isSyncing: false })
    }
  },

  checkOut: async () => {
    set({ isSyncing: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Enforce Daily Task Completion
      const { useDailyTasksStore } = await import('./dailyTasksStore')
      const taskStore = useDailyTasksStore.getState()
      
      // Ensure tasks are fresh before checking
      await taskStore.fetchTasks()
      
      if (taskStore.hasPendingTasks()) {
        toast.error('Cannot End Shift: You have incomplete tasks for today!', {
          description: 'Please complete or remove pending tasks before signing out.',
          duration: 5000
        })
        throw new Error('PENDING_TASKS')
      }

      // Offline Intercept
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('vibe_timedesk_offline_queue') || '[]')
        queue.push({
          action: 'check_out',
          timestamp: new Date().toISOString()
        })
        localStorage.setItem('vibe_timedesk_offline_queue', JSON.stringify(queue))

        set({ activeSession: null, activeBreak: null, workDuration: 0, breakDuration: 0 })
        toast.info('Offline Mode: Shift ended locally. Synchronization pending.')
        return
      }

      const { error } = await supabase.rpc('handle_check_out', {
        p_user_id: user.id
      })

      if (error) throw error
      
      set({ activeSession: null, activeBreak: null, workDuration: 0, breakDuration: 0 })
      toast.success('Work session completed. Well done!')
    } catch (err: any) {
      if (err.message !== 'PENDING_TASKS') {
        toast.error(err.message || 'Failed to check out')
      }
    } finally {
      set({ isSyncing: false })
    }
  },

  startBreak: async (type) => {
    const { activeSession } = get()
    if (!activeSession) return

    set({ isSyncing: true })
    try {
      // Offline Intercept
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('vibe_timedesk_offline_queue') || '[]')
        queue.push({
          action: 'start_break',
          timestamp: new Date().toISOString(),
          payload: {
            sessionId: activeSession.id,
            orgId: activeSession.organization_id,
            userId: activeSession.user_id,
            type
          }
        })
        localStorage.setItem('vibe_timedesk_offline_queue', JSON.stringify(queue))

        set({
          activeBreak: {
            id: 'offline-break-' + Date.now(),
            work_session_id: activeSession.id,
            start_time: new Date().toISOString(),
            end_time: null,
            type
          }
        })
        toast.info(`Offline Mode: Break started locally (${type.replace('_', ' ')}).`)
        return
      }

      // --- Break Limit Enforcement ---
      // Fetch the org break limit from settings (default 60 minutes if not configured)
      const { useTimeDeskSettingsStore } = await import('./timeDeskSettingsStore')
      const settingsStore = useTimeDeskSettingsStore.getState()
      // Fetch settings if not already loaded
      if (!settingsStore.workSettings) await settingsStore.fetchSettings()
      const maxBreakMinutes = settingsStore.workSettings?.max_break_minutes ?? 60
      const maxBreakSeconds = maxBreakMinutes * 60

      let remainingSec = maxBreakSeconds

      if (type !== 'meeting') {
        // Calculate total completed break seconds for this session (skipping meetings)
        const { data: existingBreaks } = await supabase
          .from('break_sessions')
          .select('*')
          .eq('work_session_id', activeSession.id)

        const totalUsedBreakSec = (existingBreaks || []).reduce((acc: number, b: any) => {
          if (b.type === 'meeting') return acc // Skip meetings!
          const bStart = new Date(b.start_time)
          const bEnd = b.end_time ? new Date(b.end_time) : new Date()
          return acc + Math.max(0, Math.floor((bEnd.getTime() - bStart.getTime()) / 1000))
        }, 0)

        if (totalUsedBreakSec >= maxBreakSeconds) {
          toast.error(`Break limit reached! You have used all ${maxBreakMinutes} minutes allowed per shift.`, {
            description: 'No more breaks are permitted for this shift.',
            duration: 5000
          })
          set({ isSyncing: false })
          return
        }

        remainingSec = maxBreakSeconds - totalUsedBreakSec
        // Warn when getting close (within 5 minutes)
        if (remainingSec <= 300 && remainingSec > 0) {
          toast.warning(`Break Warning: Only ${Math.ceil(remainingSec / 60)} minute(s) of break time remaining today.`)
        }
      }

      const { data: breakSess, error } = await supabase
        .from('break_sessions')
        .insert({
          work_session_id: activeSession.id,
          organization_id: activeSession.organization_id,
          user_id: activeSession.user_id,
          type
        })
        .select()
        .single()

      if (error) throw error
      set({ activeBreak: breakSess })
      if (type === 'meeting') {
        toast.success("Joined Meeting: Shift timer is running as Focus / Active Work.")
      } else {
        toast.info(`Break started: ${type.replace('_', ' ')} (${Math.floor(remainingSec / 60)}m remaining)`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start break')
    } finally {
      set({ isSyncing: false })
    }
  },

  endBreak: async () => {
    const { activeBreak } = get()
    if (!activeBreak) return

    set({ isSyncing: true })
    try {
      // Offline Intercept
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('vibe_timedesk_offline_queue') || '[]')
        queue.push({
          action: 'end_break',
          timestamp: new Date().toISOString(),
          payload: { breakId: activeBreak.id }
        })
        localStorage.setItem('vibe_timedesk_offline_queue', JSON.stringify(queue))

        set({ activeBreak: null })
        toast.info('Offline Mode: Break ended locally. Resuming work.')
        return
      }

      const { error } = await supabase
        .from('break_sessions')
        .update({ end_time: new Date().toISOString() })
        .eq('id', activeBreak.id)

      if (error) throw error
      set({ activeBreak: null })
      toast.success('Break ended. Resuming work.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to end break')
    } finally {
      set({ isSyncing: false })
    }
  },

  getSuggestedBreakType: () => {
    const now = new Date()
    const time = now.getHours() * 100 + now.getMinutes()
    
    // Official Windows (with 15m buffer)
    if (time >= 1045 && time <= 1130) return 'tea'
    if (time >= 1245 && time <= 1415) return 'lunch'
    if (time >= 1545 && time <= 1630) return 'tea'
    
    return 'short_break'
  },

  // Admin Actions
  activeSessions: [] as (WorkSession & { profile: any; break: any; activeTaskName?: string })[],
  fetchOrganizationActivity: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('work_sessions')
        .select(`
          *,
          profile:profiles(full_name, avatar_url, email),
          break:break_sessions(*)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active')

      if (error) throw error

      // Retrieve today's daily tasks dynamically for all online users
      const userIds = data?.map(s => s.user_id) || []
      let tasks: any[] = []
      if (userIds.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        const { data: fetchedTasks } = await supabase
          .from('daily_tasks')
          .select('*')
          .in('user_id', userIds)
          .eq('task_date', today)
        tasks = fetchedTasks || []
      }
      
      // Filter for active break and dynamic active task in the result
      const sessionsWithActiveBreak = data.map(s => {
        const userTasks = tasks.filter(t => t.user_id === s.user_id)
        const latestTask = userTasks.find(t => !t.is_completed) || userTasks[userTasks.length - 1] || null

        return {
          ...s,
          break: s.break?.find((b: any) => !b.end_time) || null,
          activeTaskName: latestTask ? latestTask.title : 'No Task Started'
        }
      })

      set({ activeSessions: sessionsWithActiveBreak })
    } catch (err) {
      console.error('Admin Monitoring Error:', err)
    }
  },

  syncLiveTimers: () => {
    const { activeSession } = get()
    if (!activeSession) return

    const now = new Date()
    const workStart = new Date(activeSession.start_time)
    
    // Calculate total elapsed since check-in
    const elapsed = differenceInSeconds(now, workStart)
    
    // TODO: This should eventually subtract accumulated break time
    // For live state, we just show the clock running
    set({ workDuration: elapsed })
  },

  processOfflineQueue: async () => {
    if (!navigator.onLine) return
    const queueStr = localStorage.getItem('vibe_timedesk_offline_queue')
    if (!queueStr) return

    set({ isSyncing: true })
    try {
      const queue = JSON.parse(queueStr) as { action: string; timestamp: string; payload?: any }[]
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      for (const item of queue) {
        if (item.action === 'check_in') {
          await supabase.rpc('handle_check_in', {
            p_org_id: item.payload.orgId,
            p_user_id: user.id
          })
        } else if (item.action === 'check_out') {
          await supabase.rpc('handle_check_out', {
            p_user_id: user.id
          })
        } else if (item.action === 'start_break') {
          const isOfflineSession = item.payload.sessionId.startsWith('offline-')
          let targetSessionId = item.payload.sessionId
          
          if (isOfflineSession) {
            const { data: realSession } = await supabase
              .from('work_sessions')
              .select('id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle()
            if (realSession) targetSessionId = realSession.id
          }

          await supabase.from('break_sessions').insert({
            work_session_id: targetSessionId,
            organization_id: item.payload.orgId,
            user_id: user.id,
            type: item.payload.type,
            start_time: item.timestamp
          })
        } else if (item.action === 'end_break') {
          const isOfflineBreak = item.payload.breakId.startsWith('offline-')
          let targetBreakId = item.payload.breakId

          if (isOfflineBreak) {
            const { data: realBreak } = await supabase
              .from('break_sessions')
              .select('id')
              .eq('user_id', user.id)
              .is('end_time', null)
              .maybeSingle()
            if (realBreak) targetBreakId = realBreak.id
          }

          await supabase.from('break_sessions')
            .update({ end_time: item.timestamp })
            .eq('id', targetBreakId)
        }
      }
      localStorage.removeItem('vibe_timedesk_offline_queue')
      toast.success('Offline time tracking records synchronized successfully!')
    } catch (err) {
      console.error('Offline queue processing failed:', err)
    } finally {
      set({ isSyncing: false })
    }
  }
}))
