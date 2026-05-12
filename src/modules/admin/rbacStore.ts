import { create } from 'zustand'
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
  fetchUserPermissions: (userId: string) => Promise<void>
  createRole: (role: Partial<Role>, permissionIds: string[]) => Promise<void>
  updateRole: (roleId: string, updates: Partial<Role>, permissionIds: string[]) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  hasPermission: (code: string) => boolean
}

// ============================================================
// SYSTEM ROLES — the three roles that must always exist
// ============================================================
const SYSTEM_ROLES = [
  { name: 'Administrator', description: 'Full organization access and team management' },
  { name: 'HR',            description: 'Manage employee directory, attendance and leave' },
  { name: 'Employee',      description: 'Standard workspace access for operations' },
]

// ============================================================
// STORE
// ============================================================
export const useRBACStore = create<RBACState>((set, get) => ({
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
        const { count, error: countErr } = await supabase
          .from('permissions')
          .select('*', { count: 'exact', head: true })
        
        if (!countErr && count !== null) {
          set({ totalPermissionCount: count })
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
      set({ permissions: data || [] })
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
  fetchUserPermissions: async (userId: string) => {
    const s = get() as any
    const now = Date.now()
    const THROTTLE_MS = 5000

    // Already fetching, or fetched recently for same user
    if (s.__fetchingUserPerms) return
    if (s.__lastUserPermsFetchAt && now - s.__lastUserPermsFetchAt < THROTTLE_MS && s.__lastPermUserId === userId) return

    s.__fetchingUserPerms = true
    s.__lastPermUserId = userId
    s.__lastUserPermsFetchAt = now
    set({ isPermissionsLoading: true })

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role:roles (
            role_permissions (
              permission:permissions ( code )
            )
          )
        `)
        .eq('user_id', userId)

      if (error) throw error

      const perms = new Set<string>()
      ;(data || []).forEach((ur: any) => {
        ;(ur.role?.role_permissions || []).forEach((rp: any) => {
          if (rp.permission?.code) perms.add(rp.permission.code)
        })
      })

      const sorted = Array.from(perms).sort()
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

      // 1. Clear existing permissions for this role
      await supabase.from('role_permissions').delete().eq('role_id', roleId)

      // 2. Batch insert new permissions (deduplicated)
      if (permissionIds.length > 0) {
        const uniqueIds = [...new Set(permissionIds)]
        const { error: insErr } = await supabase
          .from('role_permissions')
          .insert(
            uniqueIds.map(pid => ({ role_id: roleId, permission_id: pid }))
          )
        
        if (insErr) throw insErr
      }

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
    return get().userPermissions.includes(code)
  },
}))
