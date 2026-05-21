import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useTheme } from "@/hooks/useTheme"
import Grainient from "@/components/ui/Grainient"
import { Loader2, Plus, Settings2 } from "lucide-react"

// Dashboard Engine Imports
import { useDashboardEngine } from "@/modules/dashboard/dashboardEngineStore"
import { DynamicWidgetRenderer } from "@/modules/dashboard/components/engine/EngineWidgets"

export default function Dashboard() {
  const { profile } = useAuthStore()
  const { theme } = useTheme()
  const { 
    currentTemplate, 
    isLoading, 
    initializeEngine 
  } = useDashboardEngine()

  useEffect(() => {
    if (profile) {
      initializeEngine(profile.role, profile.department)
    }
  }, [profile, initializeEngine])

  return (
    <PageWrapper
      title={currentTemplate ? currentTemplate.name : "Performance Dashboard"}
      description="Enterprise dynamic workforce intelligence & performance engine."
    >
      {/* Dynamic Theme Backgrounds */}
      {theme === 'dark' && (
        <div className="absolute top-0 right-0 w-[600px] h-[400px] -mr-32 -mt-32 opacity-20 pointer-events-none blur-3xl transition-opacity duration-1000">
          <Grainient
            color1="#6366f1"
            color2="#a855f7"
            color3="#111111"
            timeSpeed={0.15}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
            Loading Dynamic Workspace Architecture...
          </p>
        </div>
      ) : !currentTemplate ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
          <Settings2 className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-black text-slate-500">No dashboard template assigned for your role.</p>
          <p className="text-xs text-slate-400">Please contact your administrator to provision your dashboard.</p>
        </div>
      ) : (
        <div className="space-y-8 relative z-10">
          
          {/* Dynamic Grid Layout Engine */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 auto-rows-min">
            {currentTemplate.layouts
              ?.sort((a, b) => a.sort_order - b.sort_order)
              .map(layout => {
                // In a true grid system, you would apply grid_position (e.g. col-span-X).
                // We map grid.w (width) to col-spans.
                let colSpanClass = 'col-span-1'
                if (layout.grid_position?.w === 2) colSpanClass = 'md:col-span-2'
                if (layout.grid_position?.w === 3) colSpanClass = 'xl:col-span-3'
                if (layout.grid_position?.w === 4) colSpanClass = 'col-span-full'
                
                return (
                  <div key={layout.id} className={`${colSpanClass}`}>
                    <DynamicWidgetRenderer layout={layout} />
                  </div>
                )
              })}
          </div>

        </div>
      )}
    </PageWrapper>
  )
}
