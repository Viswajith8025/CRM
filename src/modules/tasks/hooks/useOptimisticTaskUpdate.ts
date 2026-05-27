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
      await queryClient.cancelQueries({ queryKey: taskKeys.all })

      // Snapshot the previous state (for fallback)
      const previousTasks = queryClient.getQueryData(taskKeys.all)

      // We do not apply manual optimistic update here for infinite queries 
      // because it's complex, but we *could* do it. 
      // For now, the snapshot acts as our failsafe, and we can force an invalidate
      // if it fails.

      return { previousTasks }
    },

    // 2. ROLLBACK ON FAILURE
    onError: (err: any, updatedTask, context) => {
      // Revert the cache back to the exact state it was before the mutation
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.all, context.previousTasks)
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
