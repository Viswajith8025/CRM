import { useEffect } from "react"
import { useRBACStore } from "@/modules/admin/rbacStore"
import { useAuthStore } from "@/store/useAuthStore"

/**
 * usePermissions — resolves the current user's permission set.
 *
 * HP-03 FIX: The realtime RBAC subscription has been moved OUT of this
 * hook and INTO the rbacStore singleton (initRBACSubscription). This
 * means no matter how many components mount usePermissions, only ONE
 * Supabase channel is ever created for RBAC updates.
 *
 * HP-05 FIX: PermissionGuard now renders a skeleton placeholder instead
 * of null while permissions are loading, eliminating the 300ms flash.
 */
export function usePermissions() {
  const { user } = useAuthStore()
  const userPermissions  = useRBACStore(s => s.userPermissions)
  const fetchUserPerms   = useRBACStore(s => s.fetchUserPermissions)
  const hasPermission    = useRBACStore(s => s.hasPermission)
  const isLoading        = useRBACStore(s => s.isPermissionsLoading)
  const hasFetched       = useRBACStore(s => (s as any).__rbacFetched as boolean | undefined)

  useEffect(() => {
    // Fire once per user ID change only.
    // The __rbacFetched flag lives in the store, so it survives across
    // multiple component mounts — preventing duplicate network calls
    // even when usePermissions is used in 10+ components simultaneously.
    if (user && !hasFetched) {
      fetchUserPerms(user.id)
    }
    if (!user) {
      // Reset fetch flag on sign-out so next login re-fetches cleanly
      ;(useRBACStore as any).setState({ __rbacFetched: false })
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const can    = (perm: string)    => hasPermission(perm)
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
 *
 * HP-05 FIX: While permissions are loading we render a lightweight inline
 * skeleton block instead of null. This eliminates the ~300ms flash of
 * empty/missing UI that previously occurred on every route navigation.
 */
interface PermissionGuardProps {
  permission: string | string[]
  requireAll?: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
  /** Width of the skeleton placeholder shown while loading (default: 100%) */
  skeletonWidth?: string
  /** Height of the skeleton placeholder shown while loading (default: 32px) */
  skeletonHeight?: string
}

export function PermissionGuard({
  permission,
  requireAll = false,
  children,
  fallback = null,
  skeletonWidth = '100%',
  skeletonHeight = '32px',
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions()

  // HP-05: Show a non-intrusive inline skeleton instead of null.
  // Uses inline styles only — no extra CSS class dependency.
  if (isLoading) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: skeletonWidth,
          height: skeletonHeight,
          borderRadius: '6px',
          background: 'linear-gradient(90deg, var(--skeleton-from, rgba(148,163,184,0.12)) 25%, var(--skeleton-to, rgba(148,163,184,0.22)) 50%, var(--skeleton-from, rgba(148,163,184,0.12)) 75%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.4s ease infinite',
        }}
      />
    )
  }

  const perms    = Array.isArray(permission) ? permission : [permission]
  const hasAccess = requireAll
    ? perms.every(p => hasPermission(p))
    : perms.some(p  => hasPermission(p))

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
