import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface ActivityRecord {
  id: string
  user_id: string
  action: string
  target_type: string
  target_id: string
  target_name: string
  metadata: any
  created_at: string
  profiles?: {
    full_name: string
    avatar_url: string
  }
}

interface ActivityState {
  activities: ActivityRecord[]
  isLoading: boolean
  error: string | null
  
  fetchActivities: (filters?: {
    userId?: string
    targetType?: string
    targetId?: string
    limit?: number
  }) => Promise<void>
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  isLoading: false,
  error: null,

  fetchActivities: async (filters) => {
    set({ isLoading: true })
    try {
      let query = supabase
        .from('activities')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50)

      if (filters?.userId) query = query.eq('user_id', filters.userId)
      if (filters?.targetType) query = query.eq('target_type', filters.targetType)
      if (filters?.targetId) query = query.eq('target_id', filters.targetId)

      const { data, error } = await query
      
      if (error) throw error
      set({ activities: data as ActivityRecord[], error: null })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  }
}))
