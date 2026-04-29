import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { LoadingState } from '@/components/shared/LoadingState'

export const ProtectedRoute = () => {
  const { session, isLoading } = useAuthStore()

  // During initial session check, show a loading state
  if (isLoading) {
    return <LoadingState />
  }

  // If no session exists, redirect to login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
