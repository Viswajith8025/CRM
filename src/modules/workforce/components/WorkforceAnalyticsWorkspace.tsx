import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useWorkforceStore } from '../store/workforceStore'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DynamicDashboardEngine } from './DynamicDashboardEngine'

export function WorkforceAnalyticsWorkspace() {
  const { profile } = useAuthStore()
  const { kpis, layouts, isLoading, fetchKPIs, fetchLayout } = useWorkforceStore()
  const department = profile?.department || 'development' // Fallback to development for testing

  useEffect(() => {
    fetchKPIs(department)
    fetchLayout(department)
  }, [department, fetchKPIs, fetchLayout])

  const layout = layouts.find(l => l.department === department) || null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground">
            {department.charAt(0).toUpperCase() + department.slice(1)} Analytics
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
        <div className="flex justify-center p-12">
          <div className="h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <DynamicDashboardEngine layout={layout} kpis={kpis} department={department} />
      )}
    </div>
  )
}
