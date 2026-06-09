import { usePermissions } from '@/hooks/usePermissions'
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
  children,
  skeletonWidth = '100%',
  skeletonHeight = '32px',
}: PermissionGuardProps & { skeletonWidth?: string, skeletonHeight?: string }) {
  const { can, canAll, canAny, isLoading } = usePermissions()

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
