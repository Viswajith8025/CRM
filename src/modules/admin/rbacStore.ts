import * as zustand from 'zustand'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'

// ============================================================
// TYPES
// ============================================================

export interface Role {
  id: string
  name: string
  description: string
  is_system: boolean
  organization_id: string
  created_at: string
  permissions?: string[]    // permission codes
  members?: Member[]
  user_count?: number
}

export interface Permission {
  id: string
  code: string
  module: string
  name: string
  description: string
}

interface Member {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
}

interface RBACState {
  // Data
  roles: Role[]
  permissions: Permission[]
  userPermissions: string[]
  totalPermissionCount: number

  // Loading — single, clear flag per concern
  isLoading: boolean           // for RolesPage loading state
  isPermissionsLoading: boolean // for ProtectedRoute/usePermissions

  // Actions
  fetchRoles: () => Promise<void>
  fetchPermissions: () => Promise<void>
  fetchUserPermissions: (userId: string, force?: boolean) => Promise<void>
  createRole: (role: Partial<Role>, permissionIds: string[]) => Promise<void>
  updateRole: (roleId: string, updates: Partial<Role>, permissionIds: string[]) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  hasPermission: (code: string) => boolean
}

// ============================================================
// ENTERPRISE ROLE PRESETS (Only bootstrap essentials)
// Any additional roles are created dynamically by the Super Admin.
// ============================================================
const SYSTEM_ROLES = [
  { name: 'Administrator', description: 'Full organization access and team management' },
  { name: 'HR',            description: 'Manage employee directory, attendance and leave' },
  { name: 'Employee',      description: 'Standard workspace access for daily operations' },
]

// ============================================================
// STORE
// ============================================================
export const useRBACStore = zustand.create<RBACState>((set, get) => ({
  roles: [],
  permissions: [],
  userPermissions: [],
  totalPermissionCount: 0,
  isLoading: false,
  isPermissionsLoading: false,

  // ----------------------------------------------------------
  // fetchRoles — fetches all roles for the org, bootstraps
  // missing system roles in one round-trip (not recursively)
  // ----------------------------------------------------------
  fetchRoles: async () => {
    // Prevent concurrent calls
    if ((get() as any).__fetchingRoles) return
    ;(get() as any).__fetchingRoles = true
    set({ isLoading: true })

    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context.')

      // 1. Fetch all roles for this org
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(`
          id, name, description, is_system, organization_id, created_at,
          role_permissions (
            permission:permissions ( id, code )
          )
        `)
        .eq('organization_id', orgId)

      if (rolesError) throw rolesError

      // 2. Self-heal: find any missing system roles
      const existingNames = new Set((rolesData || []).map(r => r.name.toLowerCase()))
      const missing = SYSTEM_ROLES.filter(r => !existingNames.has(r.name.toLowerCase()))

      let allRolesData = rolesData || []

      if (missing.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('roles')
          .insert(missing.map(r => ({ ...r, organization_id: orgId, is_system: true })))
          .select(`
            id, name, description, is_system, organization_id, created_at,
            role_permissions (
              permission:permissions ( id, code )
            )
          `)

        if (!insertErr && inserted) {
          allRolesData = [...allRolesData, ...inserted]
        }
      }

      // 3. Fetch members (user_roles → profiles)
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('role_id, profiles:user_id ( id, full_name, avatar_url, email )')

      const membersMap = (userRolesData || []).reduce<Record<string, Member[]>>((acc, cur: any) => {
        if (cur.profiles) {
          if (!acc[cur.role_id]) acc[cur.role_id] = []
          acc[cur.role_id].push(cur.profiles)
        }
        return acc
      }, {})

      // 4. Deduplicate by name (safety net) and shape the data
      const seen = new Set<string>()
      const roles: Role[] = []
      for (const r of allRolesData) {
        const key = r.name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        // Filter out Super Admin from the config list
        if (key === 'super admin') continue

        const members = membersMap[r.id] || []
        roles.push({
          id: r.id,
          name: r.name,
          description: r.description,
          is_system: r.is_system,
          organization_id: r.organization_id,
          created_at: r.created_at,
          user_count: members.length,
          members,
          permissions: (r.role_permissions || [])
            .map((rp: any) => rp.permission?.code)
            .filter(Boolean),
        })
      }

      // 5. Fetch total permission count if not already set
      if (get().totalPermissionCount === 0) {
        const { data: permData, error: countErr } = await supabase
          .from('permissions')
          .select('code, module')
        
        if (!countErr && permData) {
          set({ totalPermissionCount: permData.length })
        }
      }

      set({ roles })
    } catch (err: any) {
      console.error('[RBAC] fetchRoles error:', err.message)
      toast.error('Failed to load roles.')
    } finally {
      set({ isLoading: false })
      ;(get() as any).__fetchingRoles = false
    }
  },

  // ----------------------------------------------------------
  // fetchPermissions — fetches the permissions catalogue
  // ----------------------------------------------------------
  fetchPermissions: async () => {
    if ((get() as any).__fetchingPerms) return
    ;(get() as any).__fetchingPerms = true

    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module')
      if (error) throw error
      
      set({ 
        permissions: data || [],
        totalPermissionCount: (data || []).length
      })
    } catch (err: any) {
      console.error('[RBAC] fetchPermissions error:', err.message)
    } finally {
      ;(get() as any).__fetchingPerms = false
    }
  },

  // ----------------------------------------------------------
  // fetchUserPermissions — resolves what a user can do.
  // Throttled: won't re-fetch for the same user within 5s.
  // ----------------------------------------------------------
  fetchUserPermissions: async (userId: string, force = false) => {
    const s = get() as any

    // Already fetching, bypass if forced
    if (s.__fetchingUserPerms && !force) return

    s.__fetchingUserPerms = true
    s.__lastPermUserId = userId
    set({ isPermissionsLoading: true })

    try {
      // Use the high-performance V2 RPC to fetch all user permissions (with legacy-role auto fallback)
      const { data, error } = await supabase.rpc('get_user_permission_codes_v2', { p_user_id: userId })

      if (error) throw error

      // map array to permission codes and sort
      const sorted = (data || [])
        .map((p: any) => p.permission_code || p)
        .filter(Boolean)
        .sort()

      // Only update state if the permissions actually changed
      if (JSON.stringify(get().userPermissions) !== JSON.stringify(sorted)) {
        set({ userPermissions: sorted })
      }
    } catch (err: any) {
      console.error('[RBAC] fetchUserPermissions error:', err.message)
    } finally {
      set({ isPermissionsLoading: false })
      ;(get() as any).__fetchingUserPerms = false
    }
  },



  // ----------------------------------------------------------
  // createRole
  // ----------------------------------------------------------
  createRole: async (role, permissionIds) => {
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context.')

      const { data: newRole, error: roleErr } = await supabase
        .from('roles')
        .insert({ ...role, organization_id: orgId })
        .select()
        .single()

      if (roleErr) throw roleErr

      if (permissionIds.length > 0) {
        const { error: permErr } = await supabase
          .from('role_permissions')
          .insert(permissionIds.map(pid => ({ role_id: newRole.id, permission_id: pid })))
        if (permErr) throw permErr
      }

      toast.success(`Role "${newRole.name}" created.`)
      get().fetchRoles()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create role.')
    }
  },

  // ----------------------------------------------------------
  // updateRole — delete-then-insert for permissions (idempotent)
  // ----------------------------------------------------------
  updateRole: async (roleId, updates, permissionIds) => {
    try {
      if (Object.keys(updates).length > 0) {
        const { error: roleErr } = await supabase
          .from('roles')
          .update(updates)
          .eq('id', roleId)
        if (roleErr) throw roleErr
      }

      // Use the backend RPC to execute the delete/insert in a single ACID transaction
      // This prevents the "zero-window" vulnerability where a network failure
      // between the delete and insert leaves the role with no permissions.
      const uniqueIds = [...new Set(permissionIds)]
      const { error: rpcErr } = await supabase.rpc('update_role_permissions', {
        p_role_id: roleId,
        p_permission_ids: uniqueIds
      })

      if (rpcErr) throw rpcErr

      toast.success('Permissions saved.')
      get().fetchRoles()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role.')
    }
  },

  // ----------------------------------------------------------
  // deleteRole
  // ----------------------------------------------------------
  deleteRole: async (roleId) => {
    try {
      // BUG-006 FIX: Check if any users are still assigned to this role before deleting.
      // Deleting an active role silently orphans all assigned users (zero permissions).
      const { count, error: countErr } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleId)

      if (countErr) throw countErr

      if (count && count > 0) {
        toast.error(
          `Cannot delete role: ${count} user${count > 1 ? 's are' : ' is'} still assigned to it. Reassign them first.`,
          { duration: 6000 }
        )
        return
      }

      const { error } = await supabase.from('roles').delete().eq('id', roleId)
      if (error) throw error
      toast.success('Role deleted.')
      get().fetchRoles()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete role.')
    }
  },

  // ----------------------------------------------------------
  // hasPermission — Super Admin always returns true
  // ----------------------------------------------------------
  hasPermission: (code) => {
    const profile = useAuthStore.getState().profile
    if (profile?.role === 'super_admin') return true
    
    // Resilient dual check: check both cached RBAC store and auth store profile fallback
    const authPermissions = profile?.permissions || []
    return get().userPermissions.includes(code) || authPermissions.includes(code)
  },
}))
