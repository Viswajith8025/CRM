import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { taskKeys } from './useTasksQuery'

export function useOptimisticTaskUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updatedTask: any) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: updatedTask.status, assigned_to: updatedTask.assigned_to })
        .eq('id', updatedTask.id)
        .select()
        .single()
        
      if (error) throw error
      return data
    },

    // 1. SNAPSHOT & APPLY OPTIMISM
    onMutate: async (updatedTask) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() })

      // Snapshot the previous states for all task lists
      const previousQueries = queryClient.getQueriesData({ queryKey: taskKeys.lists() })

      // Apply optimistic update directly to all Infinite Query cache structures
      queryClient.setQueriesData({ queryKey: taskKeys.lists() }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((task: any) => 
              task.id === updatedTask.id ? { ...task, ...updatedTask } : task
            )
          }))
        }
      })

      return { previousQueries }
    },

    // 2. ROLLBACK ON FAILURE
    onError: (err: any, updatedTask, context) => {
      // Revert the caches back to the exact states they were before the mutation
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData)
        })
      }
      
      // Notify the user of the exact reason (e.g. RLS failure)
      toast.error('Action Rejected', {
        description: err.message || 'You do not have permission to modify this task.'
      })
    },

    // 3. RECONCILE WITH BACKEND
    onSettled: () => {
      // Always fetch the real state from the server after the dust settles
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    }
  })
}
