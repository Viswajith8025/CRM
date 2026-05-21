import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { Filter, Settings2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { useDashboardEngine } from '@/modules/dashboard/dashboardEngineStore'
import { DynamicWidgetRenderer } from '@/modules/dashboard/components/engine/EngineWidgets'

export function WorkforceAnalyticsWorkspace() {
  const { profile } = useAuthStore()
  const department = profile?.department || 'development' 
  
  const { 
    currentTemplate, 
    isLoading, 
    initializeEngine,
    fetchPerformanceLogs
  } = useDashboardEngine()

  useEffect(() => {
    if (profile) {
      initializeEngine(profile.role, profile.department)
      // Fetch the last 30 days of logs for this user
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      fetchPerformanceLogs(profile.id, startDate, endDate)
    }
  }, [profile, initializeEngine, fetchPerformanceLogs])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground">
            {currentTemplate ? currentTemplate.name : `${department.charAt(0).toUpperCase() + department.slice(1)} Analytics`}
          </h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Real-time workforce intelligence
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-2 bg-background/50">
            <Filter className="h-3.5 w-3.5" />
            Dynamic Filters
          </Button>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 auto-rows-min">
          {currentTemplate.layouts
            ?.sort((a, b) => a.sort_order - b.sort_order)
            .map(layout => {
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
      )}
    </div>
  )
}
