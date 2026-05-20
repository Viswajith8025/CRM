import React from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { usePermissions } from '@/hooks/usePermissions'

interface HasAccessProps {
  roles?: ('super_admin' | 'admin' | 'manager' | 'employee' | 'client')[]
  permission?: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * A wrapper component that conditionally renders children based on the user's role or permission.
 */
export function HasAccess({ roles, permission, children, fallback = null }: HasAccessProps) {
  const { profile } = useAuthStore()
  const { hasPermission } = usePermissions()

  const isSuperAdmin = profile?.role === 'super_admin'

  // Permission check takes precedence
  if (permission) {
    if (isSuperAdmin || hasPermission(permission)) {
      return <>{children}</>
    }
    return <>{fallback}</>
  }

  // Legacy Role check
  if (roles && profile && (isSuperAdmin || roles.includes(profile.role as any))) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

// Keep HasRole for compatibility
export const HasRole = HasAccess
