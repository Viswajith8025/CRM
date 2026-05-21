import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'

export interface Department {
  id: string
  organization_id: string
  name: string
  slug: string
  description?: string
  status: 'active' | 'inactive'
  leader_id?: string
  created_at: string
}

export interface DepartmentSetting {
  id: string
  department_id: string
  weekly_hours_capacity: number
  escalation_email?: string
  sla_threshold_hours: number
}

export interface DepartmentKPI {
  id: string
  department_id: string
  name: string
  metric_key: string
  target_value: number
  current_value: number
  unit: string
}

export interface DepartmentDashboard {
  id: string
  department_id: string
  layout_config: any
  enabled_widgets: string[]
}

interface DepartmentState {
  departments: Department[]
  activeSettings: DepartmentSetting | null
  activeKPIs: DepartmentKPI[]
  activeDashboard: DepartmentDashboard | null
  isLoading: boolean
  error: string | null

  // CRUD Actions
  fetchDepartments: () => Promise<void>
  createDepartment: (dept: Partial<Department>) => Promise<void>
  updateDepartment: (id: string, dept: Partial<Department>) => Promise<void>
  deleteDepartment: (id: string) => Promise<void>

  // Settings & Configuration
  fetchDepartmentSettings: (deptId: string) => Promise<void>
  updateDepartmentSettings: (deptId: string, settings: Partial<DepartmentSetting>) => Promise<void>

  // KPI Management
  fetchDepartmentKPIs: (deptId: string) => Promise<void>
  syncKPIValue: (kpiId: string, value: number) => Promise<void>
  createDepartmentKPI: (deptId: string, kpi: Partial<DepartmentKPI>) => Promise<void>

  // Dashboard Configuration layout
  fetchDepartmentDashboard: (deptId: string) => Promise<void>
  updateDepartmentDashboardLayout: (deptId: string, layout: any, widgets: string[]) => Promise<void>

  // Team Member Reassignment
  reassignMember: (profileId: string, newDeptId: string, isPrimary?: boolean) => Promise<void>
}

// Fallback departments in case database migration hasn't run yet
const LOCAL_FALLBACK_DEPTS: Department[] = [
  { id: "d1", organization_id: "00000000-0000-0000-0000-000000000000", name: "Web Developing", slug: "web_developing", description: "Core engineering, frontend, and backend architecture.", status: "active", created_at: new Date().toISOString() },
  { id: "d2", organization_id: "00000000-0000-0000-0000-000000000000", name: "Video Editing", slug: "video_editing", description: "Post-production, rendering, and visual effects.", status: "active", created_at: new Date().toISOString() },
  { id: "d3", organization_id: "00000000-0000-0000-0000-000000000000", name: "Videography", slug: "videography", description: "Camera operations, live shooting, and lighting.", status: "active", created_at: new Date().toISOString() },
  { id: "d4", organization_id: "00000000-0000-0000-0000-000000000000", name: "Graphic Designing", slug: "graphic_designing", description: "UI/UX prototypes, branding, and graphic elements.", status: "active", created_at: new Date().toISOString() },
  { id: "d5", organization_id: "00000000-0000-0000-0000-000000000000", name: "Digital Marketing", slug: "digital_marketing", description: "Campaigns, SEO, and paid ad management.", status: "active", created_at: new Date().toISOString() },
  { id: "d6", organization_id: "00000000-0000-0000-0000-000000000000", name: "Content Writer", slug: "content_writer", description: "Editorial pipelines, publishing queues, and reviews.", status: "active", created_at: new Date().toISOString() },
  { id: "d7", organization_id: "00000000-0000-0000-0000-000000000000", name: "CRM", slug: "crm", description: "Client relations, onboarding, and support tickets.", status: "active", created_at: new Date().toISOString() },
  { id: "d8", organization_id: "00000000-0000-0000-0000-000000000000", name: "BDE", slug: "bde", description: "Business development, sales pipelines, and outreach.", status: "active", created_at: new Date().toISOString() },
]

export const useDepartmentStore = create<DepartmentState>((set, get) => ({
  departments: LOCAL_FALLBACK_DEPTS,
  activeSettings: null,
  activeKPIs: [],
  activeDashboard: null,
  isLoading: false,
  error: null,

  fetchDepartments: async () => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) {
        // Fallback silently if table doesn't exist
        if (error.code === 'PGRST116' || error.message.includes('relation "departments" does not exist')) {
          console.warn("Departments schema not present. Using mock bootstrap items.")
          set({ departments: LOCAL_FALLBACK_DEPTS, isLoading: false })
          return
        }
        throw error
      }

      set({ departments: data || [], isLoading: false })
    } catch (err: any) {
      console.error("Error fetching departments:", err)
      set({ error: err.message, isLoading: false })
    }
  },

  createDepartment: async (dept) => {
    set({ isLoading: true })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('departments')
        .insert({
          ...dept,
          organization_id: orgId,
          slug: dept.name?.toLowerCase().replace(/\s+/g, '-') || 'custom-dept'
        })
        .select()
        .single()

      if (error) throw error

      set({ 
        departments: [...get().departments, data],
        isLoading: false 
      })
      toast.success(`Department "${data.name}" registered successfully!`)
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || "Failed to register department.")
    }
  },

  updateDepartment: async (id, dept) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('departments')
        .update(dept)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      set({
        departments: get().departments.map(d => d.id === id ? data : d),
        isLoading: false
      })
      toast.success("Department updated successfully!")
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || "Failed to update department.")
    }
  },

  deleteDepartment: async (id) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id)

      if (error) throw error

      set({
        departments: get().departments.filter(d => d.id !== id),
        isLoading: false
      })
      toast.success("Department deleted successfully.")
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || "Failed to delete department.")
    }
  },

  fetchDepartmentSettings: async (deptId) => {
    try {
      const { data, error } = await supabase
        .from('department_settings')
        .select('*')
        .eq('department_id', deptId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      set({ activeSettings: data || null })
    } catch (err: any) {
      console.warn("Failed fetching settings:", err.message)
    }
  },

  updateDepartmentSettings: async (deptId, settings) => {
    try {
      const { data, error } = await supabase
        .from('department_settings')
        .update(settings)
        .eq('department_id', deptId)
        .select()
        .single()

      if (error) throw error
      set({ activeSettings: data })
      toast.success("Operational capacity settings saved.")
    } catch (err: any) {
      toast.error("Failed to update settings: " + err.message)
    }
  },

  fetchDepartmentKPIs: async (deptId) => {
    try {
      const { data, error } = await supabase
        .from('department_kpis')
        .select('*')
        .eq('department_id', deptId)

      if (error) throw error
      set({ activeKPIs: data || [] })
    } catch (err: any) {
      console.warn("Failed fetching KPIs:", err.message)
    }
  },

  syncKPIValue: async (kpiId, value) => {
    try {
      const { error } = await supabase
        .from('department_kpis')
        .update({ current_value: value })
        .eq('id', kpiId)

      if (error) throw error
      set({
        activeKPIs: get().activeKPIs.map(k => k.id === kpiId ? { ...k, current_value: value } : k)
      })
    } catch (err: any) {
      console.error("Failed to sync KPI:", err.message)
    }
  },

  createDepartmentKPI: async (deptId, kpi) => {
    try {
      const { data, error } = await supabase
        .from('department_kpis')
        .insert({
          ...kpi,
          department_id: deptId
        })
        .select()
        .single()

      if (error) throw error
      set({ activeKPIs: [...get().activeKPIs, data] })
      toast.success("KPI registered in operational catalog.")
    } catch (err: any) {
      toast.error("Failed to register KPI: " + err.message)
    }
  },

  fetchDepartmentDashboard: async (deptId) => {
    try {
      const { data, error } = await supabase
        .from('department_dashboards')
        .select('*')
        .eq('department_id', deptId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      set({ activeDashboard: data || null })
    } catch (err: any) {
      console.warn("Failed fetching dashboard layout config:", err.message)
    }
  },

  updateDepartmentDashboardLayout: async (deptId, layout, widgets) => {
    try {
      const { data, error } = await supabase
        .from('department_dashboards')
        .update({
          layout_config: layout,
          enabled_widgets: widgets
        })
        .eq('department_id', deptId)
        .select()
        .single()

      if (error) throw error
      set({ activeDashboard: data })
      toast.success("Dashboard layout workspace bound.")
    } catch (err: any) {
      toast.error("Failed to update layout: " + err.message)
    }
  },

  reassignMember: async (profileId, newDeptId, isPrimary = true) => {
    try {
      // 1. Delete existing primary mappings if this reassignment is primary
      if (isPrimary) {
        const { error: delErr } = await supabase
          .from('department_members')
          .delete()
          .eq('profile_id', profileId)
          .eq('is_primary', true)

        if (delErr) throw delErr
      }

      // 2. Insert or Update new member relation
      const { error: upsertErr } = await supabase
        .from('department_members')
        .upsert({
          department_id: newDeptId,
          profile_id: profileId,
          is_primary: isPrimary
        }, {
          onConflict: 'department_id,profile_id'
        })

      if (upsertErr) throw upsertErr

      toast.success("Team member department reassignment completed.")
    } catch (err: any) {
      console.error("Failed to reassign team member:", err)
      toast.error("Failed to reassign team member: " + err.message)
    }
  }
}))
