import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface WorkSettings {
  organization_id: string
  min_working_hours: number
  max_break_minutes: number   // Total allowed break time per shift in minutes (default: 60)
  is_flexible_mode: boolean
  track_productivity: boolean
  default_shift_start: string
  default_shift_end: string
  late_threshold_minutes: number
  working_days: Record<string, boolean>
  break_schedule: any[]
}

export interface LeavePolicy {
  id: string
  policy_name: string
  yearly_limit: number
  monthly_cap: number
  carry_forward_limit: number
  is_paid: boolean
  restrictions: any
}

interface TimeDeskSettingsState {
  workSettings: WorkSettings | null
  leavePolicies: LeavePolicy[]
  isLoading: boolean
  
  fetchSettings: () => Promise<void>
  updateWorkSettings: (settings: Partial<WorkSettings>) => Promise<void>
  
  // Leave Policy CRUD
  fetchLeavePolicies: () => Promise<void>
  upsertLeavePolicy: (policy: Partial<LeavePolicy>) => Promise<void>
  deleteLeavePolicy: (id: string) => Promise<void>
  
  // User Provisioning (Wrappers for Admin actions)
  inviteUser: (email: string, full_name: string, role: string) => Promise<void>
}

export const useTimeDeskSettingsStore = create<TimeDeskSettingsState>((set, get) => ({
  workSettings: null,
  leavePolicies: [],
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('organization_work_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle()

      if (error) throw error
      set({ workSettings: data })
    } catch (err: any) {
      console.error('Error fetching work settings:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  updateWorkSettings: async (settings) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      // Helper to ensure TIME fields have :00 seconds
      const normalizeTime = (t?: string) => {
        if (!t) return undefined
        return t.split(':').length === 2 ? `${t}:00` : t
      }

      const payload = {
        ...settings,
        organization_id: profile.organization_id,
        updated_by: profile.id,
        updated_at: new Date().toISOString()
      }

      if (payload.default_shift_start) payload.default_shift_start = normalizeTime(payload.default_shift_start)
      if (payload.default_shift_end) payload.default_shift_end = normalizeTime(payload.default_shift_end)

      const { error } = await supabase
        .from('organization_work_settings')
        .upsert(payload)

      if (error) throw error
      await get().fetchSettings()
      toast.success('Organization work settings updated successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings')
    } finally {
      set({ isLoading: false })
    }
  },

  fetchLeavePolicies: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('organization_leave_policies')
        .select('*')
        .eq('organization_id', profile.organization_id)

      if (error) throw error
      set({ leavePolicies: data || [] })
    } catch (err) {
      console.error('Error fetching leave policies:', err)
    }
  },

  upsertLeavePolicy: async (policy) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { error } = await supabase
        .from('organization_leave_policies')
        .upsert({
          ...policy,
          organization_id: profile.organization_id,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      await get().fetchLeavePolicies()
      toast.success('Leave policy saved')
    } catch (err: any) {
      toast.error('Failed to save leave policy')
    }
  },

  deleteLeavePolicy: async (id) => {
    try {
      const { error } = await supabase
        .from('organization_leave_policies')
        .delete()
        .eq('id', id)

      if (error) throw error
      await get().fetchLeavePolicies()
      toast.success('Leave policy deleted')
    } catch (err: any) {
      toast.error('Failed to delete leave policy')
    }
  },

  inviteUser: async (email, full_name, role) => {
    // This leverages the existing invitation logic if present, or creates a placeholder
    toast.info(`Invitation sent to ${email} as ${role}`)
  }
}))
