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
  sendHeartbeat: () => Promise<void>
  startHeartbeatSync: () => void
  stopHeartbeatSync: () => void
}

let heartbeatInterval: any = null;

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
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user) return

      // Fetch active work session with all breaks
      const { data: session, error: sError } = await supabase
        .from('work_sessions')
        .select('*, break_sessions(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (sError) throw sError

      if (session) {
        const breakSess = session.break_sessions?.find((b: any) => !b.end_time) || null
        set({ activeSession: session, activeBreak: breakSess })
        get().syncLiveTimers()
        get().startHeartbeatSync()
      } else {
        set({ activeSession: null, activeBreak: null, workDuration: 0, breakDuration: 0 })
        get().stopHeartbeatSync()
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
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user || !profile?.organization_id) return

      // Online Enforcer
      if (!navigator.onLine) {
        toast.error('Cannot check in while offline. Accurate server time is required to prevent time fraud.')
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
      get().startHeartbeatSync()
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
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
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

      // Online Enforcer
      if (!navigator.onLine) {
        toast.error('Cannot check out while offline. Server connection is required.')
        return
      }

      const { error } = await supabase.rpc('handle_check_out', {
        p_user_id: user.id
      })

      if (error) throw error
      
      set({ activeSession: null, activeBreak: null, workDuration: 0, breakDuration: 0 })
      get().stopHeartbeatSync()
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
      // Online Enforcer
      if (!navigator.onLine) {
        toast.error('Cannot start break while offline.')
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
      // Online Enforcer
      if (!navigator.onLine) {
        toast.error('Cannot end break while offline.')
        return
      }

      const { error } = await supabase.rpc('handle_end_break', { p_break_id: activeBreak.id })

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
    
    // Calculate accumulated break time
    const breaks = (activeSession as any).break_sessions || []
    const totalBreakSec = breaks.reduce((acc: number, b: any) => {
      // Meetings don't count against work time
      if (b.type === 'meeting') return acc
      const bStart = new Date(b.start_time)
      const bEnd = b.end_time ? new Date(b.end_time) : now
      return acc + Math.max(0, Math.floor((bEnd.getTime() - bStart.getTime()) / 1000))
    }, 0)

    set({ 
      workDuration: Math.max(0, elapsed - totalBreakSec),
      breakDuration: totalBreakSec 
    })
  },

  processOfflineQueue: async () => {
    // Offline queueing is deprecated to enforce strict server-side timestamps.
    // This function is kept for signature compatibility but disabled.
    localStorage.removeItem('vibe_timedesk_offline_queue');
  },

  sendHeartbeat: async () => {
    const { activeSession } = get()
    if (!activeSession || !navigator.onLine) return
    try {
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user) return
      await supabase.rpc('handle_session_heartbeat', {
        p_user_id: user.id
      })
    } catch (err) {
      console.error('Failed to send heartbeat', err)
    }
  },

  startHeartbeatSync: () => {
    get().stopHeartbeatSync()
    // Send one immediately, then every 5 minutes (300,000 ms)
    get().sendHeartbeat()
    heartbeatInterval = setInterval(() => {
      get().sendHeartbeat()
    }, 5 * 60 * 1000)
  },

  stopHeartbeatSync: () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }
}))
