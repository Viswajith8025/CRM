import React from 'react'
import { useAuthStore } from '@/store/useAuthStore'

interface HasRoleProps {
  roles: ('admin' | 'manager' | 'employee')[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * A wrapper component that conditionally renders children based on the user's role.
 */
export function HasRole({ roles, children, fallback = null }: HasRoleProps) {
  const { profile } = useAuthStore()

  if (!profile || !roles.includes(profile.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
