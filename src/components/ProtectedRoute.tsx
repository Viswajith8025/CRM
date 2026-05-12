import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { LoadingState } from '@/components/shared/LoadingState'
import { ShieldX, Clock, LogOut } from 'lucide-react'

interface ProtectedRouteProps {
  allowedRoles?: ('super_admin' | 'admin' | 'manager' | 'employee' | 'client')[]
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { session, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return <LoadingState />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // 2.5 ORGANIZATION SUSPENDED - block access
  if (profile?.is_org_suspended) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="bg-rose-500/10 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-500/20 shadow-2xl shadow-rose-500/10">
            <ShieldX className="h-12 w-12 text-rose-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Access Suspended</h1>
          <p className="text-slate-400 font-medium">
            Organization access suspended
          </p>
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-sm text-rose-200/60">
            Your organization's subscription has been suspended or is past due. Please contact your administrator.
          </div>
          <button
            onClick={() => useAuthStore.getState().signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white text-black font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // 3. DENIED — hard block
  if (profile?.status === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="bg-rose-500/10 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-500/20 shadow-2xl shadow-rose-500/10">
            <ShieldX className="h-12 w-12 text-rose-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Access Denied</h1>
          <p className="text-slate-400 font-medium">
            Your account (<span className="text-rose-400 font-bold">{profile.email}</span>) has been reviewed and <span className="text-rose-500 underline decoration-2 underline-offset-4">denied access</span>.
          </p>
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-sm text-rose-200/60">
            Contact your organization administrator if you believe this is a mistake.
          </div>
          <button
            onClick={() => useAuthStore.getState().signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white text-black font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  // 4. PENDING or NULL PROFILE — waiting for approval
  // If the profile is active, we continue. If not, we show the pending screen.
  if (profile?.status !== 'active') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <div className="max-w-xl space-y-8">
          <div className="bg-blue-500/10 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto border border-blue-500/20 shadow-2xl shadow-blue-500/10">
            <Clock className="h-12 w-12 text-blue-500 animate-pulse" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tighter text-white">Verification Successful</h1>
            <p className="text-xl text-slate-400 font-medium">Wait for Administrator Approval</p>
          </div>

          <p className="text-slate-500 max-w-sm mx-auto">
            Your email is confirmed. However, <span className="text-white font-bold">The System</span> requires a manual security review before granting access.
          </p>

          <div className="grid gap-4 p-6 rounded-3xl bg-white/5 border border-white/10 text-left">
            <div className="flex items-start gap-4">
              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0 mt-1">1</div>
              <p className="text-sm text-slate-300"><span className="text-white font-bold">Admin Review:</span> A system administrator has been notified of your registration.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0 mt-1">2</div>
              <p className="text-sm text-slate-300"><span className="text-white font-bold">Role Assignment:</span> You will be assigned the <span className="italic text-blue-400">Employee</span> role by default.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0 mt-1">3</div>
              <p className="text-sm text-slate-300"><span className="text-white font-bold">Access Granted:</span> Once approved, this page will automatically refresh.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => useAuthStore.getState().fetchProfile()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 transition-all active:scale-95 shadow-xl shadow-blue-600/20"
            >
              Check My Status
            </button>
            <button
              onClick={() => useAuthStore.getState().signOut()}
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 5. ROLE CHECK
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
