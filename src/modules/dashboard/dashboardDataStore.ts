import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

export interface DashboardStats {
  revenue: number
  active_projects: number
  overdue_tasks: number
  utilization: number
  total_minutes: number
}

export interface RevenueChartPoint {
  name: string
  revenue: number
  projected: number
}

export interface ActivitySummary {
  id: string
  actor_name: string
  action_type: string
  target_name: string
  created_at: string
}

export interface ProjectHealth {
  id: string
  name: string
  progress: number
  total_tasks: number
  completed_tasks: number
  status: string
}

export interface CriticalDeadline {
  id: string
  title: string
  due_date: string
  project_name: string
  status: string
  is_overdue: boolean
}

interface DashboardDataState {
  stats: DashboardStats | null
  chartData: RevenueChartPoint[]
  activities: ActivitySummary[]
  projectHealth: ProjectHealth[]
  criticalDeadlines: CriticalDeadline[]
  isLoading: boolean
  error: string | null
  
  fetchDashboardData: () => Promise<void>
  fetchProjectHealth: () => Promise<void>
  fetchCriticalDeadlines: () => Promise<void>
  fetchChartData: (days?: number) => Promise<void>
  fetchRecentActivity: (limit?: number) => Promise<void>
}

export const useDashboardDataStore = create<DashboardDataState>((set, get) => ({
  stats: null,
  chartData: [],
  activities: [],
  projectHealth: [],
  criticalDeadlines: [],
  isLoading: false,
  error: null,

  fetchDashboardData: async (startDate?: string, endDate?: string) => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase.rpc('get_aggregated_dashboard_data', {
        p_org_id: orgId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      })

      if (error) throw error

      // Override active projects count to match the UI tab "Active Projects" (unarchived)
      let activeProjectsCount = data.stats.active_projects;
      try {
        let query = supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .or('is_archived.is.null,is_archived.eq.false')
          
        if (startDate) query = query.gte('created_at', startDate)
        if (endDate) query = query.lte('created_at', endDate)

        const { count } = await query;
        if (count !== null) activeProjectsCount = count;
      } catch (e) {
        console.error("Failed to fetch accurate active projects count", e)
      }

      set({ 
        stats: {
          ...data.stats,
          active_projects: activeProjectsCount
        },
        projectHealth: data.health,
        criticalDeadlines: data.deadlines,
        activities: data.activities,
        chartData: (data.chart || []).map((d: any) => ({
          ...d,
          revenue: Number(d.revenue),
          projected: Number(d.projected)
        })),
        isLoading: false
      })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  fetchProjectHealth: async () => { /* Redundant now */ },
  fetchCriticalDeadlines: async () => { /* Redundant now */ },
  fetchChartData: async () => { /* Redundant now */ },
  fetchRecentActivity: async () => { /* Redundant now */ }
}))
