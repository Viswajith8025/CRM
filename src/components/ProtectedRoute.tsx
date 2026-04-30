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

  // Check user status (Approval Workflow)
  // Only block if status is explicitly pending or denied
  if (profile && (profile.status === 'pending' || profile.status === 'denied')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Approval Pending</h1>
          <p className="text-muted-foreground font-medium">
            Your account ({profile.email}) is currently being reviewed by our administration team.
            You will receive access once your profile is approved.
          </p>
          <div className="pt-6">
            <button
              onClick={() => useAuthStore.getState().signOut()}
              className="text-sm font-bold text-primary hover:underline"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If specific roles are required, check the user's role
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
