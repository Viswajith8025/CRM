import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { throttle } from 'lodash'
import { toast } from 'sonner'
import { taskKeys } from '@/modules/tasks/hooks/useTasksQuery'

// A debounced toast prevents the screen from filling with 50 popups in 1 second
const debouncedToast = throttle((msg: string) => {
  toast.info(msg, { duration: 3000 })
}, 2000, { leading: true, trailing: false })

export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const profile = useAuthStore(state => state.profile)

  useEffect(() => {
    if (!profile?.organization_id) return

    // Throttle the invalidation so we only refetch once every 2 seconds MAX
    // regardless of how many individual rows change in the database.
    const throttledInvalidateTasks = throttle(() => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      debouncedToast('Tasks updated')
    }, 2000, { leading: false, trailing: true })

    const channel = supabase
      .channel(`org_sync_${profile.organization_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `organization_id=eq.${profile.organization_id}` },
        () => {
          throttledInvalidateTasks()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      throttledInvalidateTasks.cancel()
    }
  }, [profile?.organization_id, queryClient])
}
