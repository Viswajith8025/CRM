import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface KPI {
  id: string
  code: string
  name: string
  data_type: 'number' | 'currency' | 'percentage' | 'time'
  aggregation_type: 'sum' | 'avg' | 'count' | 'max' | 'min'
}

export interface DashboardMetric {
  id: string
  kpi_id: string
  display_name?: string
  color_hex?: string
  kpi?: KPI
}

export interface DashboardLayout {
  id: string
  template_id: string
  widget_type: 'metric_card' | 'graph' | 'data_table' | 'custom_component' | 'timeline'
  widget_code: string
  title: string
  grid_position: { x: number, y: number, w: number, h: number }
  config: any
  metrics?: DashboardMetric[]
}

export interface DashboardTemplate {
  id: string
  name: string
  target_role: string
  layouts?: DashboardLayout[]
}

export interface PerfLog {
  kpi_id: string
  log_date: string
  value: number
}

interface DashboardEngineState {
  currentTemplate: DashboardTemplate | null
  kpis: KPI[]
  performanceLogs: PerfLog[]
  isLoading: boolean
  error: string | null
  
  initializeEngine: (role: string, departmentSlug?: string) => Promise<void>
  fetchPerformanceLogs: (employeeId: string, startDate: string, endDate: string) => Promise<void>
  logPerformance: (employeeId: string, kpiCode: string, value: number, metadata?: any) => Promise<void>
}

export const useDashboardEngine = create<DashboardEngineState>((set, get) => ({
  currentTemplate: null,
  kpis: [],
  performanceLogs: [],
  isLoading: false,
  error: null,

  initializeEngine: async (role, departmentSlug) => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization found')

      // 1. Fetch KPIs
      const { data: kpiData } = await supabase.from('kpi_registry').select('*')
      if (kpiData) set({ kpis: kpiData })

      // 2. Fetch Template based on role/department
      // Try to find an exact match first, or fallback to default
      let query = supabase.from('dashboard_templates')
        .select(`
          *,
          layouts:dashboard_layouts(
            *,
            metrics:dashboard_metrics(
              *,
              kpi:kpi_registry(*)
            )
          )
        `)
        .eq('organization_id', orgId)

      const { data: templates } = await query

      let selectedTemplate = templates?.find(t => t.target_role?.toLowerCase() === role.toLowerCase())
      
      // If no specific template found, try to find a generic one
      if (!selectedTemplate) {
        selectedTemplate = templates?.find(t => t.is_default)
      }

      set({ currentTemplate: selectedTemplate || null })
    } catch (err: any) {
      console.error('Failed to initialize dashboard engine:', err)
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchPerformanceLogs: async (employeeId, startDate, endDate) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('employee_performance_logs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('employee_id', employeeId)
        .gte('log_date', startDate)
        .lte('log_date', endDate)

      if (error) throw error
      set({ performanceLogs: data || [] })
    } catch (err) {
      console.error('Failed to fetch performance logs', err)
    }
  },

  logPerformance: async (employeeId, kpiCode, value, metadata = {}) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const kpi = get().kpis.find(k => k.code === kpiCode)
      if (!kpi) {
        console.warn(`KPI ${kpiCode} not found in registry`)
        return
      }

      const today = new Date().toISOString().split('T')[0]

      // UPSERT LOG (if it exists for today, we might want to add to it or overwrite based on aggregation)
      // For simplicity, let's assume 'sum' means we should add to it, but UPSERT in Supabase replaces the row.
      // To do an atomic increment, we would need an RPC. But for this MVP, we will just upsert.
      
      // To be safe and scalable, we'll use an RPC for atomic increment if it's a sum, or just insert.
      // But standard Supabase upsert replaces. We will do a read-then-write for now if it's sum.
      
      let finalValue = value
      if (kpi.aggregation_type === 'sum') {
        const { data: existing } = await supabase
          .from('employee_performance_logs')
          .select('value')
          .eq('employee_id', employeeId)
          .eq('kpi_id', kpi.id)
          .eq('log_date', today)
          .single()
        if (existing) {
          finalValue += Number(existing.value)
        }
      }

      await supabase.from('employee_performance_logs').upsert({
        organization_id: orgId,
        employee_id: employeeId,
        kpi_id: kpi.id,
        log_date: today,
        value: finalValue,
        metadata
      }, { onConflict: 'employee_id,kpi_id,log_date' })

    } catch (err) {
      console.error('Failed to log performance', err)
    }
  }
}))
