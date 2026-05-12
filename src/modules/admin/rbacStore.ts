import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface Role {
  id: string
  name: string
  description: string
  is_system: boolean
  created_at: string
  permissions?: string[]
}

export interface Permission {
  id: string
  code: string
  module: string
  name: string
  description: string
}

interface RBACState {
  roles: Role[]
  permissions: Permission[]
  userPermissions: string[]
  isLoading: boolean
  fetchRoles: () => Promise<void>
  fetchPermissions: () => Promise<void>
  fetchUserPermissions: (userId: string) => Promise<void>
  createRole: (role: Partial<Role>, permissionIds: string[]) => Promise<void>
  updateRole: (roleId: string, updates: Partial<Role>, permissionIds: string[]) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  hasPermission: (code: string) => boolean
}

export const useRBACStore = create<RBACState>((set, get) => ({
  roles: [],
  permissions: [],
  userPermissions: [],
  isLoading: false,

  fetchRoles: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('roles')
        .select(`
          *,
          role_permissions(
            permission:permissions(code)
          )
        `)
      
      if (error) throw error

      const roles = data.map((r: any) => ({
        ...r,
        permissions: r.role_permissions.map((rp: any) => rp.permission.code)
      }))

      set({ roles, isLoading: false })
    } catch (error: any) {
      toast.error(error.message)
      set({ isLoading: false })
    }
  },

  fetchPermissions: async () => {
    const { data, error } = await supabase.from('permissions').select('*')
    if (error) toast.error(error.message)
    else set({ permissions: data })
  },

  fetchUserPermissions: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role:roles(
            role_permissions(
              permission:permissions(code)
            )
          )
        `)
        .eq('user_id', userId)

      if (error) throw error

      const perms = new Set<string>()
      data?.forEach((ur: any) => {
        ur.role?.role_permissions?.forEach((rp: any) => {
          perms.add(rp.permission.code)
        })
      })

      set({ userPermissions: Array.from(perms) })
    } catch (error: any) {
      console.error('RBAC Error:', error.message)
    }
  },

  createRole: async (role, permissionIds) => {
    try {
      const { data: newRole, error: roleError } = await supabase
        .from('roles')
        .insert(role)
        .select()
        .single()

      if (roleError) throw roleError

      const rolePerms = permissionIds.map(pid => ({
        role_id: newRole.id,
        permission_id: pid
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePerms)

      if (permError) throw permError

      toast.success('Role created successfully')
      get().fetchRoles()
    } catch (error: any) {
      toast.error(error.message)
    }
  },

  updateRole: async (roleId, updates, permissionIds) => {
    try {
      const { error: roleError } = await supabase
        .from('roles')
        .update(updates)
        .eq('id', roleId)

      if (roleError) throw roleError

      // Sync permissions: Delete old, Insert new
      await supabase.from('role_permissions').delete().eq('role_id', roleId)
      
      const rolePerms = permissionIds.map(pid => ({
        role_id: roleId,
        permission_id: pid
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePerms)

      if (permError) throw permError

      toast.success('Role updated successfully')
      get().fetchRoles()
    } catch (error: any) {
      toast.error(error.message)
    }
  },

  deleteRole: async (roleId) => {
    const { error } = await supabase.from('roles').delete().eq('id', roleId)
    if (error) toast.error(error.message)
    else {
      toast.success('Role deleted')
      get().fetchRoles()
    }
  },

  hasPermission: (code) => {
    const state = get()
    // Super Admin override (if we want a bypass)
    // if (state.userPermissions.includes('super_admin')) return true
    return state.userPermissions.includes(code)
  }
}))
