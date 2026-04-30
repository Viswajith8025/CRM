import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { LoadingState } from '@/components/shared/LoadingState'

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'manager' | 'employee')[]
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { session, profile, isLoading } = useAuthStore()

  // During initial session check, show a loading state
  if (isLoading) {
    return <LoadingState />
  }

  // If no session exists, redirect to login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // If specific roles are required, check the user's role
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
