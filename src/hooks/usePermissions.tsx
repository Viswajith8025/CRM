import { useEffect, useRef } from "react"
import { useRBACStore } from "@/modules/admin/rbacStore"
import { useAuthStore } from "@/store/useAuthStore"

/**
 * usePermissions — resolves the current user's permission set.
 *
 * Design decisions:
 * - Uses a ref to track whether we've already triggered a fetch in this
 *   component lifecycle so we don't fire duplicate network calls.
 * - Does NOT re-fetch when userPermissions.length changes, because that
 *   would cause a fetch → update → fetch loop.
 */
export function usePermissions() {
  const { user } = useAuthStore()
  const userPermissions  = useRBACStore(s => s.userPermissions)
  const fetchUserPerms   = useRBACStore(s => s.fetchUserPermissions)
  const hasPermission    = useRBACStore(s => s.hasPermission)
  const isLoading        = useRBACStore(s => s.isPermissionsLoading)
  const hasFetched       = useRef(false)

  useEffect(() => {
    // Only fetch once per mount (or when user changes)
    if (user && !hasFetched.current) {
      hasFetched.current = true
      fetchUserPerms(user.id)
    }
    if (!user) hasFetched.current = false
  }, [user?.id])

  const can    = (perm: string)   => hasPermission(perm)
  const canAll = (perms: string[]) => perms.every(p => hasPermission(p))
  const canAny = (perms: string[]) => perms.some(p  => hasPermission(p))

  return {
    hasPermission,
    can,
    canAll,
    canAny,
    isLoading,
    permissions: userPermissions,
  }
}

/**
 * PermissionGuard — renders children only if the user has the required permission(s).
 */
interface PermissionGuardProps {
  permission: string | string[]
  requireAll?: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions()

  // While loading, render nothing — avoids flash of wrong content
  if (isLoading) return null

  const perms    = Array.isArray(permission) ? permission : [permission]
  const hasAccess = requireAll
    ? perms.every(p => hasPermission(p))
    : perms.some(p  => hasPermission(p))

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
