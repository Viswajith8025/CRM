import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { LoadingState } from '@/components/shared/LoadingState'
import { ShieldX, Clock, LogOut } from 'lucide-react'

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'manager' | 'employee')[]
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { session, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return <LoadingState />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // DENIED — hard block
  if (profile?.status === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="bg-rose-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldX className="h-10 w-10 text-rose-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-rose-500">Access Denied</h1>
          <p className="text-muted-foreground font-medium">
            Your account (<span className="text-foreground font-bold">{profile.email}</span>) has been denied access by the administrator.
          </p>
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, please contact your organization admin.
          </p>
          <button
            onClick={() => useAuthStore.getState().signOut()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-sm hover:bg-rose-500/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // PENDING — waiting for approval
  if (profile?.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="bg-amber-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto">
            <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Approval Pending</h1>
          <p className="text-muted-foreground font-medium">
            Your account (<span className="text-foreground font-bold">{profile.email}</span>) is being reviewed by the admin team.
          </p>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-left space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">What happens next?</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• An administrator will review your registration</li>
              <li>• You'll be assigned a role (Employee, Manager, etc.)</li>
              <li>• Once approved, you'll have full access to the CRM</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => useAuthStore.getState().fetchProfile()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Check Status
            </button>
            <button
              onClick={() => useAuthStore.getState().signOut()}
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ROLE CHECK
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
