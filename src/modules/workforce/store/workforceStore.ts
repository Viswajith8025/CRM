import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { KPI, DashboardLayout } from '../types'

interface WorkforceState {
  kpis: KPI[]
  layouts: DashboardLayout[]
  isLoading: boolean
  error: string | null

  fetchKPIs: (department?: string) => Promise<void>
  fetchLayout: (department: string) => Promise<void>
  
  // Dynamic filter state
  filters: {
    dateRange: { start: Date; end: Date }
    departmentId?: string
    teamLeadId?: string
    employeeId?: string
    projectId?: string
    status?: string[]
  }
  setFilters: (filters: Partial<WorkforceState['filters']>) => void
}

export const useWorkforceStore = create<WorkforceState>((set, get) => ({
  kpis: [],
  layouts: [],
  isLoading: false,
  error: null,
  filters: {
    dateRange: {
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
    }
  },

  setFilters: (newFilters) => {
    set({ filters: { ...get().filters, ...newFilters } })
  },

  fetchKPIs: async (department) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      let query = supabase
        .from('department_kpi_registry')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)

      if (department) {
        query = query.eq('department', department)
      }

      const { data, error } = await query
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('relation "department_kpi_registry" does not exist')) {
          console.warn("department_kpi_registry table not populated. Using fallbacks.")
          set({ kpis: [], error: null })
          return
        }
        throw error
      }

      set({ kpis: data as KPI[], error: null })
    } catch (err: any) {
      if (err.status === 406 || err.message?.includes('Acceptable') || err.message?.includes('relation "department_kpi_registry"')) {
        console.warn("PostgREST 406 caught. Seeding migration required.")
        set({ kpis: [], error: null })
      } else {
        set({ error: err.message })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  fetchLayout: async (department) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('department_dashboard_views')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('department', department)
        .single()

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('relation "department_dashboard_views" does not exist')) {
          console.warn("department_dashboard_views table not populated. Using fallbacks.")
          set({ error: null })
          return
        }
        throw error
      }

      set((state) => ({ 
        layouts: data ? [...state.layouts.filter(l => l.department !== department), data as DashboardLayout] : state.layouts,
        error: null 
      }))
    } catch (err: any) {
      if (err.status === 406 || err.message?.includes('Acceptable') || err.message?.includes('relation "department_dashboard_views"')) {
        console.warn("PostgREST 406 caught. Seeding migration required.")
        set({ error: null })
      } else {
        set({ error: err.message })
      }
    } finally {
      set({ isLoading: false })
    }
  }
}))
