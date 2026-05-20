import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface DailyTask {
  id: string
  organization_id: string
  user_id: string
  title: string
  is_completed: boolean
  task_date: string
  created_at: string
}

interface DailyTasksState {
  tasks: DailyTask[]
  isLoading: boolean
  
  fetchTasks: () => Promise<void>
  addTask: (title: string) => Promise<void>
  toggleTask: (id: string, is_completed: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  hasPendingTasks: () => boolean
}

export const useDailyTasksStore = create<DailyTasksState>((set, get) => ({
  tasks: [],
  isLoading: false,

  fetchTasks: async () => {
    set({ isLoading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_date', today)
        .order('created_at', { ascending: true })

      if (error) throw error
      set({ tasks: data || [] })
    } catch (err: any) {
      console.error('Error fetching daily tasks:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  addTask: async (title) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user || !profile?.organization_id) return

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert({
          title,
          organization_id: profile.organization_id,
          user_id: user.id,
          task_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      if (error) throw error
      set({ tasks: [...get().tasks, data] })
      toast.success('Task added for today')
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
