import { usePermissions } from '@/hooks/usePermissions.tsx'
import { useAuthStore } from '@/store/useAuthStore'

interface PermissionGuardProps {
  permission: string | string[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * Enterprise Permission Guard
 * 
 * Protects UI components based on granular permissions.
 * 
 * Usage:
 * <PermissionGuard permission="invoices.edit" fallback={<ReadOnlyView />}>
 *   <EditableInvoiceForm />
 * </PermissionGuard>
 */
export function PermissionGuard({ 
  permission, 
  requireAll = false, 
  fallback = null, 
  children 
}: PermissionGuardProps) {
  const { can, canAll, canAny } = usePermissions()

  const hasPermission = Array.isArray(permission)
    ? (requireAll ? canAll(permission) : canAny(permission))
    : can(permission)

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Role Guard (Legacy support)
 * 
 * Protects UI based on static roles.
 */
export function RoleGuard({ 
  allowedRoles, 
  fallback = null, 
  children 
}: { 
  allowedRoles: string[], 
  fallback?: React.ReactNode, 
  children: React.ReactNode 
}) {
  const { profile } = useAuthStore()
  
  if (!profile || !allowedRoles.includes(profile.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
