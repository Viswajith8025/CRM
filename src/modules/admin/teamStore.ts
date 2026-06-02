import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string // legacy column — kept for backward compat
  dynamic_role_id?: string | null  // from user_roles join
  dynamic_role_name?: string | null // from roles join
  status: 'pending' | 'active' | 'denied' | 'archived'
  email: string | null
  hourly_rate?: number
  created_at: string
  department?: string | null
  department_id?: string | null
}

export interface DynamicRole {
  id: string
  name: string
  description: string
  is_system: boolean
}

interface TeamState {
  members: Profile[]
  dynamicRoles: DynamicRole[]
  isLoading: boolean
  fetchMembers: () => Promise<void>
  fetchDynamicRoles: () => Promise<void>
  assignDynamicRole: (userId: string, roleId: string) => Promise<void>
  updateMemberStatus: (id: string, status: Profile['status']) => Promise<void>
  updateMemberHourlyRate: (id: string, rate: number) => Promise<void>
  revokeAccess: (id: string) => Promise<void>
  archiveMember: (id: string) => Promise<void>
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  dynamicRoles: [],
  isLoading: false,

  fetchMembers: async () => {
    set({ isLoading: true })
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id

      let query = supabase
        .from('profiles')
        .select(`
          *,
          user_roles (
            role_id,
            roles:role_id ( id, name )
          ),
          department_members (
            is_primary,
            departments:department_id ( id, name )
          )
        `)

      // Super admin sees all profiles globally; admins see only their org
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { data, error } = await query.order('created_at', { ascending: true })
      if (error) throw error

      // Map the joined data to flat profile objects
      const mapped = (data || []).map((m: any) => {
        const userRole = m.user_roles?.[0]
        const primaryDeptMember = m.department_members?.find((dm: any) => dm.is_primary) || m.department_members?.[0]
        return {
          ...m,
          dynamic_role_id: userRole?.roles?.id || null,
          dynamic_role_name: userRole?.roles?.name || null,
          department: primaryDeptMember?.departments?.name || null,
          department_id: primaryDeptMember?.departments?.id || null,
          user_roles: undefined, // clean up nested data
          department_members: undefined,
        }
      })

      // Never expose the super_admin profile in the team list for regular admins
      const filtered = currentUser?.role === 'super_admin'
        ? mapped
        : mapped.filter((m: any) => m.role !== 'super_admin')

      set({ members: filtered as Profile[] })
    } catch (error) {
      console.error('Error fetching team members:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchDynamicRoles: async () => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, is_system')
        .eq('organization_id', orgId)
        .order('is_system', { ascending: false })
        .order('name')

      if (error) throw error

      // Filter out Super Admin from assignable roles
      const assignable = (data || []).filter(r => r.name.toLowerCase() !== 'super admin')
      set({ dynamicRoles: assignable as DynamicRole[] })
    } catch (error) {
      console.error('Error fetching dynamic roles:', error)
    }
  },

  assignDynamicRole: async (userId, roleId) => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!currentUser) throw new Error('Not authenticated.')

      const target = get().members.find(m => m.id === userId)
      if (target?.status === 'denied') {
        throw new Error('Cannot assign a role to a denied member.')
      }

      const { error } = await supabase.rpc('assign_user_role', {
        p_user_id: userId,
        p_role_id: roleId,
        p_assigned_by: currentUser.id,
      })

      if (error) throw error

      // Update local state with the new role
      const roleName = get().dynamicRoles.find(r => r.id === roleId)?.name || null
      set({
        members: get().members.map(m =>
          m.id === userId
            ? { ...m, dynamic_role_id: roleId, dynamic_role_name: roleName }
            : m
        ),
      })
    } catch (error: any) {
      console.error('Error assigning role:', error)
      throw new Error(error?.message || 'Failed to assign role.')
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

      // If approving a user who has no organization, assign them to the admin's org
      const updatePayload: any = { status }
      if (status === 'active' && !target?.organization_id && orgId) {
        updatePayload.organization_id = orgId
      }

      let query = supabase.from('profiles').update(updatePayload).eq('id', id)
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { error } = await query
      if (error) throw error

      set({
        members: get().members.map(m => m.id === id ? { ...m, ...updatePayload } : m),
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
    } catch (error) {
      console.error('Error revoking access:', error)
      throw error
    }
  },

  archiveMember: async (id) => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id

      // Cannot archive the super_admin
      const target = get().members.find(m => m.id === id)
      if (target?.role === 'super_admin') {
        throw new Error('The super admin account cannot be archived.')
      }

      let query = supabase.from('profiles').update({ status: 'archived' }).eq('id', id)
      if (currentUser?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { error } = await query
      if (error) throw error

      set({
        members: get().members.map(m => m.id === id ? { ...m, status: 'archived' } : m),
      })
    } catch (error) {
      console.error('Error archiving member:', error)
      throw error
    }
  }
}))
