import { useAuthStore } from '@/store/useAuthStore'
import { useMemo, useCallback } from 'react'

/**
 * Hook to check if the current user has specific permissions.
 * 
 * Usage:
 * const { can } = usePermissions()
 * if (can('billing.invoices.create')) { ... }
 */
export function usePermissions() {
  const { profile } = useAuthStore()

  const permissions = useMemo(() => {
    return profile?.permissions || []
  }, [profile?.permissions])

  /**
   * Check if user has a specific permission
   */
  const can = useCallback((permissionId: string): boolean => {
    // Admins always have all permissions (optional safety fallback)
    if (profile?.role === 'admin') return true
    
    return permissions.includes(permissionId)
  }, [permissions, profile])

  /**
   * Check if user has ALL of the specified permissions
   */
  const canAll = useCallback((permissionIds: string[]): boolean => {
    if (profile?.role === 'admin') return true
    return permissionIds.every(id => permissions.includes(id))
  }, [permissions, profile])

  /**
   * Check if user has ANY of the specified permissions
   */
  const canAny = useCallback((permissionIds: string[]): boolean => {
    if (profile?.role === 'admin') return true
    return permissionIds.some(id => permissions.includes(id))
  }, [permissions, profile])

  return {
    permissions,
    can,
    canAll,
    canAny,
    isAdmin: profile?.role === 'admin'
  }
}
