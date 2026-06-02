
import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useRBACStore } from "@/modules/admin/rbacStore"
import { Button } from "@/components/ui/button"

export function LoadingState() {
  const isAuthLoading = useAuthStore(state => state.isLoading)
  const isRBACLoading = useRBACStore(state => state.isLoading)

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-6">
      <div className="animate-pulse duration-1000">
        <img src="/ecraftzlogo.png" alt="Loading" className="h-32 w-auto object-contain brightness-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
      </div>
      <p className="text-muted-foreground animate-pulse font-bold tracking-widest text-xs uppercase">Synchronizing Data...</p>
      
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
