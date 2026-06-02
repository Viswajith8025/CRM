import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toFriendlyError, getFriendlySupabaseError } from '@/lib/supabaseError'
import { logActivity } from '@/lib/auditLogger'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { Task, Subtask as SubTask } from './types/types'
import type { TimeLog } from '@/modules/time-tracking/types'

interface TasksState {
  tasks: Task[]
  myTasks: Task[]
  myTasksLoading: boolean
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
  
  fetchTasks: (params?: Partial<PaginationParams> & { projectId?: string; includeArchived?: boolean }) => Promise<void>
  fetchMyTasks: () => Promise<void>
  addTask: (task: Partial<Task>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  archiveTask: (id: string) => Promise<void>
  
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
  myTasks: [],
  myTasksLoading: false,
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
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {}, projectId, includeArchived = false } = params
    
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      let baseQuery = supabase
        .from('tasks')
        .select('*, project:projects(name), assignee:profiles!assigned_to(full_name)', { count: 'exact' })
        .eq('organization_id', orgId)
        .is('deleted_at', null)

      const { useRBACStore } = await import('@/modules/admin/rbacStore')
      const canManageTasks = useRBACStore.getState().hasPermission('projects.manage')
      
      if (!canManageTasks && !projectId) {
        baseQuery = baseQuery.eq('assigned_to', profile.id)
      }
      
      if (!includeArchived) {
        baseQuery = baseQuery.or('is_archived.is.null,is_archived.eq.false')
      }
      
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

  fetchMyTasks: async () => {
    set({ myTasksLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      const userId = profile?.id
      if (!orgId || !userId) return

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name),
          assignee:profiles!assigned_to(full_name, avatar_url),
          module:project_modules(id, name, color, parent_id)
        `)
        .eq('organization_id', orgId)
        .eq('assigned_to', userId)
        .is('deleted_at', null)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      set({ myTasks: (data || []) as Task[] })
    } catch (err) {
      console.error('Failed to fetch my tasks:', err)
    } finally {
      set({ myTasksLoading: false })
    }
  },

  addTask: async (task) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      // Extract relation arrays from the task payload so they are not sent to the tasks table
      const { collaborators = [], dependencies = [], ...taskDetails } = task

      const taskWithOrg = { ...taskDetails, organization_id: orgId }
      const { data, error } = await supabase
        .from('tasks')
        .insert(taskWithOrg)
        .select()
        .single()

      if (error) throw error

      const createdTaskId = data.id

      // 1. Save multi-assignee co-owners to task_assignments
      if (collaborators && collaborators.length > 0) {
        const assignmentPayloads = collaborators.map(userId => ({
          task_id: createdTaskId,
          user_id: userId,
          organization_id: orgId
        }))
        const { error: assignError } = await supabase
          .from('task_assignments')
          .insert(assignmentPayloads)

        if (assignError) console.error("Collaborator assignment failed:", assignError)

        // Dispatch in-app notifications to all assigned co-owners
        try {
          const { useNotificationsStore } = await import('@/modules/notifications/notificationsStore')
          for (const userId of collaborators) {
            if (userId !== profile.id) {
              await useNotificationsStore.getState().addNotification({
                user_id: userId,
                title: "New Co-ownership Assignment",
                message: `You have been added as a co-owner on the task: "${data.title}"`,
                type: 'assignment',
                link: `/projects/${data.project_id}?tab=tasks`
              })
            }
          }
        } catch (notifErr) {
          console.error("Task assignment notifications failed:", notifErr)
        }
      }

      // 2. Save task dependencies
      if (dependencies && dependencies.length > 0) {
        const dependencyPayloads = dependencies.map(depId => ({
          task_id: createdTaskId,
          depends_on_task_id: depId,
          organization_id: orgId
        }))
        const { error: depError } = await supabase
          .from('task_dependencies')
          .insert(dependencyPayloads)

        if (depError) console.error("Task dependency insert failed:", depError)
      }

      // 3. Log enterprise audit activities in task_activity_logs
      await supabase.from('task_activity_logs').insert({
        task_id: createdTaskId,
        user_id: profile.id,
        action: 'CREATE',
        details: `Task initialized: "${data.title}" under module "${data.module_id || 'None'}". Priority: ${data.priority}.`,
        organization_id: orgId
      })

      logActivity({
        action: 'CREATE',
        targetType: 'task',
        targetId: createdTaskId,
        targetName: data.title,
        description: `New enterprise task created: ${data.title}`,
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

      const currentTask = get().tasks.find(t => t.id === id)

      // Extract co-owners and dependencies updates if provided, and sanitize status
      const { collaborators, dependencies, status: rawStatus, ...restDetails } = updates as any

      // Remap 'completed' → 'done' (DB task_status enum only has: todo, in_progress, review, done)
      const safeStatus = rawStatus === 'completed' ? 'done' : rawStatus
      const taskDetails = {
        ...restDetails,
        ...(rawStatus !== undefined ? { status: safeStatus } : {}),
      }

      console.log('[updateTask] PATCH payload:', taskDetails)

      // A. Client-side Task Dependency Check (run after sanitizing status)
      if (safeStatus === 'done') {
        const { data: deps, error: depError } = await supabase
          .from('task_dependencies')
          .select('depends_on_task_id, depends_on:tasks!depends_on_task_id(title, status)')
          .eq('task_id', id)

        if (depError) console.warn("Dependency check skipped:", depError.message)

        if (deps && deps.length > 0) {
          const unresolved = deps.filter((d: any) => {
            const status = d.depends_on?.status
            return status !== 'done'
          })
          if (unresolved.length > 0) {
            const firstUnresolvedTitle = unresolved[0].depends_on?.title || "Unfinished parent task"
            throw new Error(`Cannot complete task. Blocked by: "${firstUnresolvedTitle}"`)
          }
        }
      }

      // B. Update core task properties
      const { error } = await supabase
        .from('tasks')
        .update(taskDetails)
        .eq('id', id)

      if (error) {
        console.error('[updateTask] Supabase error:', error.code, error.message, error.details)
        throw error
      }

      // C. Re-sync multi-assignee co-owners if updated
      if (collaborators !== undefined) {
        // Delete legacy and insert new
        await supabase.from('task_assignments').delete().eq('task_id', id)
        
        if (collaborators.length > 0) {
          const assignmentPayloads = collaborators.map((userId: string) => ({
            task_id: id,
            user_id: userId,
            organization_id: orgId
          }))
          await supabase.from('task_assignments').insert(assignmentPayloads)

          // Notify newly added assignees
          try {
            const { useNotificationsStore } = await import('@/modules/notifications/notificationsStore')
            const existingAssignees = currentTask?.collaborators || []
            const newAssignees = collaborators.filter((userId: string) => !existingAssignees.includes(userId))

            for (const userId of newAssignees) {
              if (userId !== profile.id) {
                await useNotificationsStore.getState().addNotification({
                  user_id: userId,
                  title: "Assigned as Task Collaborator",
                  // BUG-002 FIX: was `data.title` and `data.project_id` which are undefined in updateTask
                  message: `You were added to the task: "${currentTask?.title || 'a task'}"`,
                  type: 'assignment',
                  link: `/projects/${currentTask?.project_id}?tab=tasks`
                })
              }
            }
          } catch (notifErr) {
            console.error("Co-owner notification update fail:", notifErr)
          }
        }
      }

      // D. Re-sync task dependencies if updated
      if (dependencies !== undefined) {
        await supabase.from('task_dependencies').delete().eq('task_id', id)
        if (dependencies.length > 0) {
          const dependencyPayloads = dependencies.map((depId: string) => ({
            task_id: id,
            depends_on_task_id: depId,
            organization_id: orgId
          }))
          await supabase.from('task_dependencies').insert(dependencyPayloads)
        }
      }

      // E. Write workforce audit trails into task_activity_logs
      let auditMessage = `Updated task details`
      let actionType = 'UPDATE'
      
      if (taskDetails.status && taskDetails.status !== currentTask?.status) {
        actionType = taskDetails.status === 'blocked' ? 'BLOCK' : 'STATUS_CHANGE'
        auditMessage = `Task status updated from "${currentTask?.status}" to "${taskDetails.status}"`
        if (taskDetails.blocked_reason) {
          auditMessage += `. Reason: "${taskDetails.blocked_reason}"`
        }
      }

      await supabase.from('task_activity_logs').insert({
        task_id: id,
        user_id: profile.id,
        action: actionType,
        details: auditMessage,
        organization_id: orgId
      })

      logActivity({
        action: updates.status ? 'STATUS_CHANGE' : 'UPDATE',
        targetType: 'task',
        targetId: id,
        targetName: currentTask?.title || '',
        description: updates.status ? `Task status changed to ${updates.status}` : `Updated task details`,
        organization_id: orgId
      })

      // Reconstruct updated task from local state + applied changes
      const mergedTask = currentTask ? { ...currentTask, ...taskDetails } : null
      if (mergedTask) {
        set({
          tasks: get().tasks.map((t) => t.id === id ? mergedTask as Task : t),
          myTasks: get().myTasks.map((t) => t.id === id ? mergedTask as Task : t)
        })
      }
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
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error
      
      const previousTasks = get().tasks
      set({ 
        tasks: previousTasks.filter(t => t.id !== id),
        myTasks: get().myTasks.filter(t => t.id !== id)
      })
    } catch (err) {
      console.error("Failed to delete task:", err)
      throw getFriendlySupabaseError(err, "Failed to delete task.")
    }
  },

  archiveTask: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('tasks')
        .update({ is_archived: true })
        .eq('id', id)
        // BUG-005 FIX: Added organization_id scope for defense-in-depth security
        .eq('organization_id', orgId)

      if (error) throw error
      set({
        tasks: get().tasks.map((t) => t.id === id ? { ...t, is_archived: true } : t)
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to archive task.")
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

      let query = supabase
        .from('task_subtasks')
        .update(updates)
        .eq('id', id)

      const { data, error } = await query
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

      let query = supabase
        .from('task_subtasks')
        .delete()
        .eq('id', id)

      const { error } = await query

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
    let channel: any = null;
    let isUnsubscribed = false;

    import('@/store/useAuthStore').then(({ useAuthStore }) => {
      if (isUnsubscribed) return;

      const orgId = useAuthStore.getState().profile?.organization_id
      if (!orgId) return

      const channelName = projectId ? `tasks_sync_${projectId}_${orgId}_${Math.random()}` : `tasks_sync_global_${orgId}_${Math.random()}`
      const filterConfig = projectId 
        ? `project_id=eq.${projectId}` 
        : `organization_id=eq.${orgId}`
      
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'tasks',
            filter: filterConfig
          },
          () => {
            get().fetchTasks({ projectId, force: true } as any)
          }
        )
        .subscribe()
    })

    return () => {
      isUnsubscribed = true;
      if (channel) supabase.removeChannel(channel)
    }
  }
}))
