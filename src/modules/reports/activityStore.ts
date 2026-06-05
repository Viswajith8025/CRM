import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Activity {
  id: string
  user_id: string
  action: string
  target_type: string
  target_name: string
  target_id: string
  metadata: any
  created_at: string
  user?: {
    full_name: string
    avatar_url: string
  }
}

interface ActivityState {
  activities: Activity[]
  isLoading: boolean
  fetchActivities: (limit?: number) => Promise<void>
  logActivity: (activity: Partial<Activity>) => Promise<void>
  subscribeToActivities: () => () => void
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoading: false,

  fetchActivities: async (limit = 50) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*, user:profiles(full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      set({ activities: data as Activity[] })
    } catch (err) {
      console.error("Failed to fetch activities:", err)
    } finally {
      set({ isLoading: false })
    }
  },

  logActivity: async (activity) => {
    try {
      const { user } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!user) return

      const { useAuthStore } = await import('@/store/useAuthStore')
      const profile = useAuthStore.getState().profile

      const { error } = await supabase
        .from('activities')
        .insert({
          ...activity,
          user_id: user.id
        })
      
      if (error) throw error
    } catch (err) {
      console.error("Failed to log activity:", err)
    }
  },

  subscribeToActivities: () => {
    const setup = async () => {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const channel = supabase
        .channel(`activities-${orgId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activities', filter: `organization_id=eq.${orgId}` },
          () => {
            get().fetchActivities()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    
    let cleanup: (() => void) | undefined;
    setup().then(fn => { if(fn) cleanup = fn });
    return () => { if(cleanup) cleanup() }
  }
}))
