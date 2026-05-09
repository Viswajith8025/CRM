import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toFriendlyError, getFriendlySupabaseError } from '@/lib/supabaseError'
import { logActivity } from '@/lib/auditLogger'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { Task, SubTask, TimeLog } from './types'

interface TasksState {
  tasks: Task[]
  subtasks: Record<string, SubTask[]>
  comments: Record<string, any[]>
  isLoading: boolean
  error: string | null
  pagination: {
    totalCount: number
    page: number
    limit: number
    totalPages: number
  }
  
  fetchTasks: (params?: Partial<PaginationParams> & { projectId?: string }) => Promise<void>
  addTask: (task: Partial<Task>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  
  fetchSubtasks: (taskId: string) => Promise<void>
  addSubtask: (subtask: Partial<SubTask>) => Promise<void>
  updateSubtask: (id: string, updates: Partial<SubTask>) => Promise<void>
  deleteSubtask: (id: string) => Promise<void>
  
  fetchComments: (taskId: string) => Promise<void>
  addComment: (comment: any) => Promise<void>
  
  addTimeLog: (log: Partial<TimeLog>) => Promise<void>
  subscribeToTasks: (projectId?: string) => () => void
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  subtasks: {},
  comments: {},
  isLoading: false,
  error: null,
  pagination: {
    totalCount: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  },

  fetchTasks: async (params = {}) => {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {}, projectId } = params
    
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      let baseQuery = supabase
        .from('tasks')
        .select('*, project:projects(name), assignee:profiles!assigned_to(full_name)', { count: 'exact' })
        .eq('organization_id', orgId)
      
      if (projectId) {
        baseQuery = baseQuery.eq('project_id', projectId)
      }

      const result = await fetchPaginatedData<Task>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set({ 
        tasks: result.data, 
        pagination: {
          totalCount: result.totalCount,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        },
        error: null 
      })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load tasks.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addTask: async (task) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const taskWithOrg = { ...task, organization_id: orgId }
      const { data, error } = await supabase
        .from('tasks')
        .insert(taskWithOrg)
        .select()
        .single()

      if (error) throw error

      logActivity({
        action: 'CREATE',
        targetType: 'task',
        targetId: data.id,
        targetName: data.title,
        description: `New task created: ${data.title}`,
        organization_id: orgId
      })

      set({ tasks: [data as Task, ...get().tasks] })
    } catch (err) {
      throw toFriendlyError(err, "Failed to create task.")
    }
  },

  updateTask: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error

      logActivity({
        action: updates.status ? 'STATUS_CHANGE' : 'UPDATE',
        targetType: 'task',
        targetId: id,
        targetName: data.title,
        description: updates.status ? `Task status changed to ${updates.status}` : `Updated task details`,
        organization_id: orgId
      })

      set({
        tasks: get().tasks.map((t) => (t.id === id ? (data as Task) : t))
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update task.")
    }
  },

  deleteTask: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error
      set({
        tasks: get().tasks.filter((t) => t.id !== id)
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete task.")
    }
  },

  fetchSubtasks: async (taskId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })

      if (error) throw error
      set({ subtasks: { ...get().subtasks, [taskId]: data as SubTask[] } })
    } catch (err) {
      console.error("Failed to fetch subtasks:", err)
    }
  },

  addSubtask: async (subtask) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...subtask, organization_id: orgId }
      const { data, error } = await supabase
        .from('task_subtasks')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      const taskId = data.task_id
      set({ subtasks: { ...get().subtasks, [taskId]: [...(get().subtasks[taskId] || []), data as SubTask] } })
    } catch (err) {
      throw toFriendlyError(err, "Failed to add subtask.")
    }
  },

  updateSubtask: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('task_subtasks')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error
      const taskId = data.task_id
      set({
        subtasks: {
          ...get().subtasks,
          [taskId]: get().subtasks[taskId].map(s => s.id === id ? data as SubTask : s)
        }
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update subtask.")
    }
  },

  deleteSubtask: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('task_subtasks')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete subtask.")
    }
  },

  fetchComments: async (taskId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('task_comments')
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .eq('task_id', taskId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })

      if (error) throw error
      set({ comments: { ...get().comments, [taskId]: data || [] } })
    } catch (err) {
      console.error("Failed to fetch comments:", err)
    }
  },

  addComment: async (comment) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...comment, organization_id: orgId }
      const { data, error } = await supabase
        .from('task_comments')
        .insert(payload)
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .single()

      if (error) throw error
      const taskId = data.task_id
      set({ comments: { ...get().comments, [taskId]: [...(get().comments[taskId] || []), data] } })
    } catch (err) {
      throw toFriendlyError(err, "Failed to add comment.")
    }
  },

  addTimeLog: async (log) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...log, organization_id: orgId, user_id: profile?.id }
      const { error } = await supabase.from('task_time_logs').insert(payload)
      if (error) throw error
      
      logActivity({
        action: 'TIME_LOG',
        targetType: 'task',
        targetId: log.task_id!,
        targetName: 'Time Log',
        description: `Logged ${(log.duration_minutes || 0) / 60} hours of work`,
        organization_id: orgId
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to log time.")
    }
  },

  subscribeToTasks: (projectId) => {
    const channelName = projectId ? `tasks_sync_${projectId}` : `tasks_sync_global`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks'
          // organization_id filter is enforced by RLS, but explicit filtering would require orgId in the closure
        },
        () => {
          get().fetchTasks({ projectId })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}))
