import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { apiCall } from '@/lib/errorHandler'
import type { Task, Subtask, TaskComment } from './types'
import { useNotificationsStore } from '@/modules/notifications/notificationsStore'
import { logActivity } from '@/lib/auditLogger'
import { notificationService } from '@/lib/notificationService'

const CACHE_TTL_MS = 5 * 60 * 1000
const getTaskCacheKey = (projectId?: string) => projectId ?? 'all'

interface TasksState {
  tasks: Task[]
  subtasks: Record<string, Subtask[]>
  comments: Record<string, TaskComment[]>
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAtByKey: Record<string, number>
  fetchTasks: (projectId?: string, force?: boolean) => Promise<void>
  addTask: (task: Partial<Task>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  subscribeToTasks: (projectId?: string) => () => void

  fetchSubtasks: (taskId: string) => Promise<void>
  addSubtask: (subtask: Partial<Subtask>) => Promise<void>
  updateSubtask: (id: string, updates: Partial<Subtask>) => Promise<void>
  
  fetchComments: (taskId: string) => Promise<void>
  addComment: (comment: Partial<TaskComment>) => Promise<void>
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  subtasks: {},
  comments: {},
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAtByKey: {},

  fetchTasks: async (projectId, force = false) => {
    const cacheKey = getTaskCacheKey(projectId)
    const lastFetchedAt = get().lastFetchedAtByKey[cacheKey]
    const isFresh = false // Force fresh fetch
    if (!force && get().hasFetched && isFresh) return
    set({ isLoading: true, error: null })
    
    await apiCall(
      async () => {
        let query = supabase
          .from('tasks')
          .select('*, project:projects(name), assignee:profiles!assigned_to(full_name, avatar_url), comments:task_comments(count)')

        if (projectId) {
          query = query.eq('project_id', projectId)
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error

        set((state) => ({
          tasks: data as Task[],
          hasFetched: state.hasFetched || !projectId,
          lastFetchedAtByKey: {
            ...state.lastFetchedAtByKey,
            [cacheKey]: Date.now(),
          },
        }))
      },
      {
        context: 'loading tasks',
        maxRetries: 2, 
        retryDelay: 1000,
        showToast: true,
      }
    ).catch((err) => {
      set({ error: err.message })
    }).finally(() => {
      set({ isLoading: false })
    })
  },

  addTask: async (task) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const taskWithOrg = { ...task, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskWithOrg)
        .select('*, project:projects(name), assignee:profiles!assigned_to(full_name, avatar_url), comments:task_comments(count)')
        .single()

      if (error) throw error

      // Audit Log
      logActivity({
        action: 'CREATE',
        targetType: 'task',
        targetId: data.id,
        targetName: data.title,
        description: `New task created: ${data.title}`
      })

      if (data.assigned_to) {
        notificationService.notifyTaskAssignment(data.id, data.assigned_to, data.title)
      }

      set((state) => ({
        tasks: [data as Task, ...state.tasks],
        error: null,
        hasFetched: true,
        lastFetchedAtByKey: {
          ...state.lastFetchedAtByKey,
          all: Date.now(),
          ...(data.project_id ? { [getTaskCacheKey(data.project_id)]: Date.now() } : {}),
        },
      }))
    } catch (err) {
      console.error("Task Store Error:", err)
      const friendlyError = toFriendlyError(err, "Failed to add task.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateTask: async (id, updates) => {
    // 1. Optimistic UI Update
    const previousTasks = get().tasks
    const taskIndex = previousTasks.findIndex(t => t.id === id)
    if (taskIndex > -1) {
      const optimisticTasks = [...previousTasks]
      optimisticTasks[taskIndex] = { ...optimisticTasks[taskIndex], ...updates } as Task
      set({ tasks: optimisticTasks })
    }

    // 2. Network Request (Queue if offline)
    await apiCall(
      async () => {
        const { data, error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', id)
          .select('*, project:projects(name), assignee:profiles!assigned_to(full_name, avatar_url), comments:task_comments(count)')
          .single()

        if (error) throw error

        // Audit Log
        if (updates.status) {
          logActivity({
            action: 'STATUS_CHANGE',
            targetType: 'task',
            targetId: id,
            targetName: data.title,
            description: `Task status changed to ${updates.status.replace('_', ' ')}`
          })
        } else {
          logActivity({
            action: 'UPDATE',
            targetType: 'task',
            targetId: id,
            targetName: data.title,
            description: `Updated task details`
          })
        }

        if (updates.assigned_to) {
          notificationService.notifyTaskAssignment(id, updates.assigned_to, data.title)
        }

        // Final UI confirmation with server data
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? (data as Task) : t)),
          error: null,
          lastFetchedAtByKey: {
            ...state.lastFetchedAtByKey,
            all: Date.now(),
            ...(data.project_id ? { [getTaskCacheKey(data.project_id)]: Date.now() } : {}),
          },
        }))
      },
      {
        context: 'updating task',
        queueIfOffline: true,
        showToast: false, // We're using optimistic UI, we only want toasts on failure
      }
    ).catch((err) => {
      // Revert Optimistic Update on failure
      set({ tasks: previousTasks, error: err.message })
    })
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks
    const deletedTask = previousTasks.find((t) => t.id === id)
    const deletedIndex = previousTasks.findIndex((t) => t.id === id)

    set({ tasks: previousTasks.filter((t) => t.id !== id) })

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      if (deletedTask) {
        logActivity({
          action: 'DELETE',
          targetType: 'task',
          targetId: id,
          targetName: deletedTask.title,
          description: `Soft deleted task: ${deletedTask.title}`
        })
      }

      set((state) => ({
        error: null,
        lastFetchedAtByKey: {
          ...state.lastFetchedAtByKey,
          all: Date.now(),
          ...(deletedTask?.project_id ? { [getTaskCacheKey(deletedTask.project_id)]: Date.now() } : {}),
        },
      }))
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to delete task.")
      set((state) => {
        if (!deletedTask || state.tasks.some((task) => task.id === id)) {
          return { error: friendlyError.message }
        }

        const tasks = [...state.tasks]
        tasks.splice(Math.max(deletedIndex, 0), 0, deletedTask)
        return { tasks, error: friendlyError.message }
      })
      throw friendlyError
    }
  },

  restoreTask: async (id) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: null })
        .eq('id', id)

      if (error) throw error

      // Refresh tasks
      get().fetchTasks(undefined, true)
      
      logActivity({
        action: 'UPDATE',
        targetType: 'task',
        targetId: id,
        targetName: 'Restored Task',
        description: `Restored a previously deleted task`
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to restore task.")
    }
  },

  subscribeToTasks: (projectId) => {
    const channel = supabase
      .channel(`tasks-${Date.now()}`)
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
            get().fetchTasks(projectId, true)
          } else if (payload.eventType === 'UPDATE') {
            get().fetchTasks(projectId, true)
          } else if (payload.eventType === 'DELETE') {
            set({ tasks: get().tasks.filter(t => t.id !== payload.old.id) })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  fetchSubtasks: async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (error) throw error
      set((state) => ({
        subtasks: { ...state.subtasks, [taskId]: data as Subtask[] }
      }))
    } catch (err) {
      console.error("Failed to fetch subtasks:", err)
    }
  },

  addSubtask: async (subtask) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...subtask, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('task_subtasks')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      set((state) => {
        const existing = state.subtasks[data.task_id] || []
        return {
          subtasks: { ...state.subtasks, [data.task_id]: [...existing, data as Subtask] }
        }
      })
    } catch (err) {
      console.error("Failed to add subtask:", err)
      throw err
    }
  },

  updateSubtask: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('task_subtasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set((state) => {
        const taskId = data.task_id
        const existing = state.subtasks[taskId] || []
        return {
          subtasks: {
            ...state.subtasks,
            [taskId]: existing.map(s => s.id === id ? data as Subtask : s)
          }
        }
      })
    } catch (err) {
      console.error("Failed to update subtask:", err)
      throw err
    }
  },

  fetchComments: async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*, user:profiles(full_name, avatar_url)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (error) throw error
      set((state) => ({
        comments: { ...state.comments, [taskId]: data as TaskComment[] }
      }))
    } catch (err) {
      console.error("Failed to fetch comments:", err)
    }
  },

  addComment: async (comment) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...comment, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('task_comments')
        .insert(payload)
        .select('*, user:profiles(full_name, avatar_url)')
        .single()

      if (error) throw error
      set((state) => {
        const existing = state.comments[data.task_id] || []
        return {
          comments: { ...state.comments, [data.task_id]: [...existing, data as TaskComment] }
        }
      })
    } catch (err) {
      console.error("Failed to add comment:", err)
      throw err
    }
  }
}))
