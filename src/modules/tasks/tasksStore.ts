import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Task } from './types'
import { useNotificationsStore } from '@/modules/notifications/notificationsStore'
import { useActivityStore } from '@/modules/reports/activityStore'

const CACHE_TTL_MS = 5 * 60 * 1000
const getTaskCacheKey = (projectId?: string) => projectId ?? 'all'

interface TasksState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAtByKey: Record<string, number>
  fetchTasks: (projectId?: string, force?: boolean) => Promise<void>
  addTask: (task: Partial<Task>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  subscribeToTasks: (projectId?: string) => () => void
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAtByKey: {},

  fetchTasks: async (projectId, force = false) => {
    const cacheKey = getTaskCacheKey(projectId)
    const lastFetchedAt = get().lastFetchedAtByKey[cacheKey]
    const isFresh = lastFetchedAt !== undefined && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && isFresh) return
    set({ isLoading: true })
    try {
      let query = supabase
        .from('tasks')
        .select('*, project:projects(name), assignee:profiles(full_name, avatar_url), comments:task_comments(count)')

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      set((state) => ({
        tasks: data as Task[],
        error: null,
        hasFetched: state.hasFetched || !projectId,
        lastFetchedAtByKey: {
          ...state.lastFetchedAtByKey,
          [cacheKey]: Date.now(),
        },
      }))
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load tasks.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addTask: async (task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select('*, project:projects(name), assignee:profiles(full_name, avatar_url), comments:task_comments(count)')
        .single()

      if (error) throw error

      // Log Activity
      useActivityStore.getState().logActivity({
        action: 'created task',
        target_type: 'task',
        target_name: data.title,
        target_id: data.id
      })

      if (data.assigned_to) {
        useNotificationsStore.getState().addNotification({
          user_id: data.assigned_to,
          title: "New Task Assigned",
          description: `You have been assigned to: ${data.title}`,
          type: 'assignment'
        })
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
      const friendlyError = toFriendlyError(err, "Failed to add task.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateTask: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*, project:projects(name), assignee:profiles(full_name, avatar_url), comments:task_comments(count)')
        .single()

      if (error) throw error

      // Log Activity
      useActivityStore.getState().logActivity({
        action: `updated task status to ${updates.status || 'modified'}`,
        target_type: 'task',
        target_name: data.title,
        target_id: data.id,
        metadata: updates
      })

      if (updates.assigned_to) {
        useNotificationsStore.getState().addNotification({
          user_id: updates.assigned_to,
          title: "Task Reassigned",
          description: `You have been assigned to: ${data.title}`,
          type: 'assignment'
        })
      }

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? (data as Task) : t)),
        error: null,
        lastFetchedAtByKey: {
          ...state.lastFetchedAtByKey,
          all: Date.now(),
          ...(data.project_id ? { [getTaskCacheKey(data.project_id)]: Date.now() } : {}),
        },
      }))
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update task.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks
    const deletedTask = previousTasks.find((t) => t.id === id)
    const deletedIndex = previousTasks.findIndex((t) => t.id === id)

    set({ tasks: previousTasks.filter((t) => t.id !== id) })

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error

      if (deletedTask) {
        useActivityStore.getState().logActivity({
          action: 'deleted task',
          target_type: 'task',
          target_name: deletedTask.title,
          target_id: id
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
  }
}))
