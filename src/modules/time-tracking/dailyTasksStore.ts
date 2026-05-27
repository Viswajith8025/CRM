import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface DailyTask {
  id: string
  organization_id: string
  user_id: string
  title: string
  notes?: string
  is_completed: boolean
  task_date: string
  created_at: string
}

interface DailyTasksState {
  tasks: DailyTask[]
  isLoading: boolean
  selectedDate: 'today' | 'tomorrow'
  
  setSelectedDate: (date: 'today' | 'tomorrow') => void
  fetchTasks: () => Promise<void>
  addTask: (title: string, notes?: string, targetDate?: 'today' | 'tomorrow') => Promise<void>
  toggleTask: (id: string, is_completed: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  hasPendingTasks: () => boolean
}

export const useDailyTasksStore = create<DailyTasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  selectedDate: 'today',

  setSelectedDate: (date) => {
    set({ selectedDate: date })
    get().fetchTasks()
  },

  fetchTasks: async () => {
    set({ isLoading: true })
    try {
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user) return

      const dateObj = new Date()
      if (get().selectedDate === 'tomorrow') {
        dateObj.setDate(dateObj.getDate() + 1)
      }
      const dateString = dateObj.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_date', dateString)
        .order('created_at', { ascending: true })

      if (error) throw error
      set({ tasks: data || [] })
    } catch (err: any) {
      console.error('Error fetching daily tasks:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  addTask: async (title, notes = '', targetDate = 'today') => {
    try {
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user || !profile?.organization_id) return

      const dateObj = new Date()
      if (targetDate === 'tomorrow') {
        dateObj.setDate(dateObj.getDate() + 1)
      }
      const taskDateString = dateObj.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert({
          title,
          notes,
          organization_id: profile.organization_id,
          user_id: user.id,
          task_date: taskDateString
        })
        .select()
        .single()

      if (error) throw error

      // Only add to current state if the added task's date matches the currently viewed date
      if (targetDate === get().selectedDate) {
        set({ tasks: [...get().tasks, data] })
      }
      
      toast.success(`Task added for ${targetDate}`)
    } catch (err: any) {
      toast.error('Failed to add task')
    }
  },

  toggleTask: async (id, is_completed) => {
    // Optimistic update
    const previousTasks = get().tasks
    set({
      tasks: previousTasks.map(t => t.id === id ? { ...t, is_completed } : t)
    })

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .update({ is_completed })
        .eq('id', id)

      if (error) throw error
    } catch (err: any) {
      set({ tasks: previousTasks })
      toast.error('Failed to update task')
    }
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks
    set({ tasks: previousTasks.filter(t => t.id !== id) })

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (err: any) {
      set({ tasks: previousTasks })
      toast.error('Failed to delete task')
    }
  },

  hasPendingTasks: () => {
    return get().tasks.some(t => !t.is_completed)
  }
}))
