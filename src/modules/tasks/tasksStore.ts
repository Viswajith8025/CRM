import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { Task, TaskStatus } from './types'

interface TasksState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  fetchTasks: (projectId?: string) => Promise<void>
  addTask: (task: Partial<Task>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  subscribeToTasks: (projectId?: string) => () => void
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async (projectId) => {
    set({ isLoading: true })
    try {
      let query = supabase
        .from('tasks')
        .select('*, project:projects(name), assignee:profiles(full_name, avatar_url)')
      
      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      set({ tasks: data as Task[], error: null })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  addTask: async (task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select('*, project:projects(name), assignee:profiles(full_name, avatar_url)')
        .single()
      
      if (error) throw error
      set({ tasks: [data as Task, ...get().tasks] })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  updateTask: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*, project:projects(name), assignee:profiles(full_name, avatar_url)')
        .single()
      
      if (error) throw error
      set({
        tasks: get().tasks.map((t) => (t.id === id ? (data as Task) : t))
      })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  deleteTask: async (id) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
      set({ tasks: get().tasks.filter((t) => t.id !== id) })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  subscribeToTasks: (projectId) => {
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          ...(projectId ? { filter: `project_id=eq.${projectId}` } : {}),
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Need to fetch again to get joined data or manually update
            get().fetchTasks(projectId)
          } else if (payload.eventType === 'UPDATE') {
            get().fetchTasks(projectId)
          } else if (payload.eventType === 'DELETE') {
            set({ tasks: get().tasks.filter(t => t.id !== payload.old.id) })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}))
