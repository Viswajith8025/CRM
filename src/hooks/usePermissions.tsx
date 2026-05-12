import { useEffect } from "react"
import { useRBACStore } from "@/modules/admin/rbacStore"
import { useAuthStore } from "@/store/useAuthStore"

/**
 * Hook to check if current user has a specific permission
 */
export function usePermissions() {
  const { user } = useAuthStore()
  const userPermissions = useRBACStore(state => state.userPermissions)
  const fetchUserPermissions = useRBACStore(state => state.fetchUserPermissions)
  const hasPermission = useRBACStore(state => state.hasPermission)
  const isLoading = useRBACStore(state => state.isLoading)

  useEffect(() => {
    if (user && (!userPermissions || userPermissions.length === 0)) {
      fetchUserPermissions(user.id)
    }
  }, [user, userPermissions?.length])

  return {
    hasPermission: typeof hasPermission === 'function' ? hasPermission : () => false,
    isLoading,
    permissions: userPermissions || []
  }
}

/**
 * Guard component that only renders children if user has permission
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
  fallback = null 
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions()

  if (isLoading) return null

  const permissions = Array.isArray(permission) ? permission : [permission]
  const hasAccess = requireAll
    ? permissions.every(p => hasPermission(p))
    : permissions.some(p => hasPermission(p))

  if (!hasAccess) return <>{fallback}</>

  return <>{children}</>
}
