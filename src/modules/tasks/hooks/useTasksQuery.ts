import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useRBACStore } from '@/modules/admin/rbacStore'
import type { Task, Subtask as SubTask } from '../types/types'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: string) => [...taskKeys.lists(), { filters }] as const,
  myTasks: () => [...taskKeys.all, 'my-tasks'] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
}

export function useTasksQuery(projectId?: string, includeArchived = false, status?: string) {
  return useInfiniteQuery({
    queryKey: taskKeys.list(`project:${projectId}-archived:${includeArchived}-status:${status}`),
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const limit = 20;

      let baseQuery = supabase
        .from('tasks')
        .select('*, project:projects(name), assignee:profiles!assigned_to(full_name)')
        .eq('organization_id', orgId)
        .is('deleted_at', null)

      const canManageTasks = useRBACStore.getState().hasPermission('projects.manage')
      if (!canManageTasks) {
        baseQuery = baseQuery.eq('assigned_to', profile.id)
      }
      
      if (!includeArchived) {
        baseQuery = baseQuery.or('is_archived.is.null,is_archived.eq.false')
      }
      
      if (projectId) {
        baseQuery = baseQuery.eq('project_id', projectId)
      }
      
      if (status && status !== 'all') {
        baseQuery = baseQuery.eq('status', status)
      }

      const { data, error } = await baseQuery
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + limit - 1)

      if (error) throw error
      return data as Task[]
    },
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.length < 20) return undefined
      return lastPageParam + 20
    }
  })
}

export function useMyTasksQuery() {
  return useQuery({
    queryKey: taskKeys.myTasks(),
    queryFn: async () => {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      const userId = profile?.id
      if (!orgId || !userId) return []

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
      return (data || []) as Task[]
    }
  })
}
