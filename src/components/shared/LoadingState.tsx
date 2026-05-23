
import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useRBACStore } from "@/modules/admin/rbacStore"
import { Button } from "@/components/ui/button"

export function LoadingState() {
  const [showSkip, setShowSkip] = useState(false)
  const isAuthLoading = useAuthStore(state => state.isLoading)
  const isRBACLoading = useRBACStore(state => state.isLoading)

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-6">
      <div className="animate-pulse duration-1000">
        <img src="/ecraftzlogo.png" alt="Loading" className="h-32 w-auto object-contain brightness-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
      </div>
      <p className="text-muted-foreground animate-pulse font-bold tracking-widest text-xs uppercase">Synchronizing Data...</p>
      
      {showSkip && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 p-2 rounded whitespace-pre text-center">
            {`Auth: ${isAuthLoading ? 'WAITING' : 'OK'}
RBAC: ${isRBACLoading ? 'WAITING' : 'OK'}
Profile: ${useAuthStore.getState().profile ? 'LOADED' : 'NULL'}
Super: ${useAuthStore.getState().profile?.role === 'super_admin' ? 'YES' : 'NO'}`}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={() => {
              useAuthStore.setState({ isLoading: false })
              useRBACStore.setState({ isLoading: false, isPermissionsLoading: false })
            }}
          >
            Force Skip Loading
          </Button>
        </div>
      )}
    </div>
  )
}


export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <img src="/ecraftzlogo.png" alt="Loading" className="h-48 w-auto object-contain brightness-125 drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]" />
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xl font-black tracking-tighter text-white">eCraftz CRM</p>
          <div className="h-1 w-48 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
