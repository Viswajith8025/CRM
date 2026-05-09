import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'client'
  status: 'pending' | 'active' | 'denied'
  email: string | null
  hourly_rate?: number
  created_at: string
}

// Roles that can be assigned via the Team Settings UI.
// 'super_admin' is intentionally EXCLUDED — it cannot be granted by any UI action.
export type AssignableRole = 'admin' | 'manager' | 'employee' | 'client'

interface TeamState {
  members: Profile[]
  isLoading: boolean
  fetchMembers: () => Promise<void>
  /**
   * Update a member's role.
   * - Calls the secure `update_member_role` database function.
   * - The DB function enforces: only super_admin can set role = 'admin'.
   * - 'super_admin' role cannot be granted by anyone via this method.
   */
  updateMemberRole: (id: string, role: AssignableRole) => Promise<void>
  updateMemberStatus: (id: string, status: Profile['status']) => Promise<void>
  updateMemberHourlyRate: (id: string, rate: number) => Promise<void>
  revokeAccess: (id: string) => Promise<void>
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  isLoading: false,

  fetchMembers: async () => {
    set({ isLoading: true })
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id

      let query = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, status, email, hourly_rate, created_at')

      // Super admin sees all profiles globally; admins see only their org
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { data, error } = await query.order('created_at', { ascending: true })
      if (error) throw error

      // Never expose the super_admin profile in the team list for regular admins
      const filtered = currentUser?.role === 'super_admin'
        ? (data || [])
        : (data || []).filter(m => m.role !== 'super_admin')

      set({ members: filtered as Profile[] })
    } catch (error) {
      console.error('Error fetching team members:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  updateMemberRole: async (id, role) => {
    // Client-side guard: prevent any attempt to set super_admin via UI
    if ((role as string) === 'super_admin') {
      throw new Error('The super_admin role cannot be assigned. There can only be one super_admin.')
    }

    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()

      // Client-side guard: only super_admin can assign the 'admin' role
      if (role === 'admin' && currentUser?.role !== 'super_admin') {
        throw new Error('Only the super admin can grant the admin role.')
      }

      // Use the secure server-side RPC function that enforces these rules at DB level
      const { error } = await supabase.rpc('update_member_role', {
        target_user_id: id,
        new_role: role
      })

      if (error) throw error

      set({
        members: get().members.map(m => m.id === id ? { ...m, role } : m),
      })
    } catch (error: any) {
      console.error('Error updating member role:', error)
      // Surface the friendly DB error message if available
      throw new Error(error?.message?.replace('FORBIDDEN: ', '') || 'Failed to update role.')
    }
  },

  updateMemberStatus: async (id, status) => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id

      // Prevent status changes on the super_admin account
      const target = get().members.find(m => m.id === id)
      if (target?.role === 'super_admin') {
        throw new Error('The super admin account status cannot be changed.')
      }

      let query = supabase.from('profiles').update({ status }).eq('id', id)
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { error } = await query
      if (error) throw error

      set({
        members: get().members.map(m => m.id === id ? { ...m, status } : m),
      })
    } catch (error: any) {
      console.error('Error updating member status:', error)
      throw error
    }
  },

  updateMemberHourlyRate: async (id, rate) => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id

      let query = supabase.from('profiles').update({ hourly_rate: rate }).eq('id', id)
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { error } = await query
      if (error) throw error

      set({
        members: get().members.map(m => m.id === id ? { ...m, hourly_rate: rate } : m),
      })
    } catch (error) {
      console.error('Error updating member hourly rate:', error)
      throw error
    }
  },

  revokeAccess: async (id) => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id

      // Cannot revoke the super_admin
      const target = get().members.find(m => m.id === id)
      if (target?.role === 'super_admin') {
        throw new Error('The super admin account cannot have access revoked.')
      }

      let query = supabase.from('profiles').update({ status: 'denied' }).eq('id', id)
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { error } = await query
      if (error) throw error

      set({
        members: get().members.map(m => m.id === id ? { ...m, status: 'denied' } : m),
      })
    } catch (error: any) {
      console.error('Error revoking access:', error)
      throw error
    }
  },
}))
