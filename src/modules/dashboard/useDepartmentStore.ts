import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'
import { logActivity } from '@/lib/auditLogger'

export interface Department {
  id: string
  organization_id: string
  name: string
  slug: string
  description?: string
  status: 'active' | 'inactive'
  leader_id?: string
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at?: string
  deleted_at?: string | null
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
  /** Soft-disables a department (sets status = 'inactive'). Does NOT hard delete. */
  disableDepartment: (id: string) => Promise<void>
  /** Reactivates a previously disabled department. */
  activateDepartment: (id: string) => Promise<void>

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

/** Converts a department name to a URL-safe slug */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export const useDepartmentStore = create<DepartmentState>((set, get) => ({
  departments: [],
  activeSettings: null,
  activeKPIs: [],
  activeDashboard: null,
  isLoading: false,
  error: null,

  // ---------------------------------------------------------------------------
  // fetchDepartments — fetches non-deleted departments for this org
  // ---------------------------------------------------------------------------
  fetchDepartments: async () => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id

      let query = supabase
        .from('departments')
        .select('*')
        .is('deleted_at', null)        // Exclude soft-deleted
        .order('name', { ascending: true })

      if (orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { data, error } = await query

      if (error) {
        // Table doesn't exist yet — silently fail until migration is run
        if (error.code === 'PGRST116' || error.message?.includes('relation "departments" does not exist')) {
          console.warn('[DepartmentStore] departments table not found. Run DEPARTMENT_MANAGEMENT_HARDENING.sql.')
          set({ departments: [], isLoading: false })
          return
        }
        throw error
      }

      set({ departments: data || [], isLoading: false })
    } catch (err: any) {
      console.error('[DepartmentStore] fetchDepartments error:', err)
      set({ error: err.message, departments: [], isLoading: false })
    }
  },

  // ---------------------------------------------------------------------------
  // createDepartment
  // ---------------------------------------------------------------------------
  createDepartment: async (dept) => {
    set({ isLoading: true })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')
      if (!dept.name?.trim()) throw new Error('Department name is required.')

      const slug = toSlug(dept.name)

      // Client-side duplicate check (DB unique constraint is the safety net)
      const exists = get().departments.some(
        d => d.name.toLowerCase() === dept.name!.toLowerCase() && d.status !== 'inactive'
      )
      if (exists) throw new Error(`A department named "${dept.name}" already exists.`)

      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: dept.name.trim(),
          slug,
          description: dept.description?.trim() || null,
          status: dept.status || 'active',
          organization_id: orgId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single()

      if (error) {
        // Translate the unique constraint violation into a friendly message
        if (error.code === '23505') {
          throw new Error(`A department with slug "${slug}" already exists in this organization.`)
        }
        throw error
      }

      set({ departments: [...get().departments, data], isLoading: false })

      logActivity({
        action: 'CREATE',
        targetType: 'organization',
        targetId: data.id,
        targetName: data.name,
        description: `Department "${data.name}" created`,
        organization_id: orgId,
      })

      toast.success(`Department "${data.name}" created successfully!`)
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || 'Failed to create department.')
      throw err
    }
  },

  // ---------------------------------------------------------------------------
  // updateDepartment
  // ---------------------------------------------------------------------------
  updateDepartment: async (id, dept) => {
    set({ isLoading: true })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      // Duplicate name check — exclude the current record being edited
      if (dept.name) {
        const exists = get().departments.some(
          d => d.id !== id && d.name.toLowerCase() === dept.name!.toLowerCase()
        )
        if (exists) throw new Error(`A department named "${dept.name}" already exists.`)
      }

      const payload: Partial<Department> = {
        ...dept,
        updated_by: profile?.id,
        updated_at: new Date().toISOString(),
      }

      // Recompute slug if name changed
      if (dept.name) {
        payload.slug = toSlug(dept.name)
        payload.name = dept.name.trim()
      }

      const { data, error } = await supabase
        .from('departments')
        .update(payload)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('A department with that name already exists in this organization.')
        }
        throw error
      }

      set({
        departments: get().departments.map(d => d.id === id ? data : d),
        isLoading: false,
      })

      logActivity({
        action: 'UPDATE',
        targetType: 'organization',
        targetId: id,
        targetName: data.name,
        description: `Department "${data.name}" updated`,
        organization_id: orgId,
      })

      toast.success('Department updated successfully!')
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || 'Failed to update department.')
      throw err
    }
  },

  // ---------------------------------------------------------------------------
  // disableDepartment — SAFE soft-disable (status = 'inactive'), NOT a hard delete
  // Linked employees, projects, and tasks are NOT affected.
  // ---------------------------------------------------------------------------
  disableDepartment: async (id) => {
    set({ isLoading: true })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const dept = get().departments.find(d => d.id === id)
      if (!dept) throw new Error('Department not found.')

      const { error } = await supabase
        .from('departments')
        .update({
          status: 'inactive',
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error

      set({
        departments: get().departments.map(d =>
          d.id === id ? { ...d, status: 'inactive' } : d
        ),
        isLoading: false,
      })

      logActivity({
        action: 'STATUS_CHANGE',
        targetType: 'organization',
        targetId: id,
        targetName: dept.name,
        description: `Department "${dept.name}" disabled`,
        previousValue: 'active',
        newValue: 'inactive',
        severity: 'warning',
        organization_id: orgId,
      })

      toast.success(`Department "${dept.name}" has been disabled.`)
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || 'Failed to disable department.')
      throw err
    }
  },

  // ---------------------------------------------------------------------------
  // activateDepartment — re-enable a disabled department
  // ---------------------------------------------------------------------------
  activateDepartment: async (id) => {
    set({ isLoading: true })
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const dept = get().departments.find(d => d.id === id)
      if (!dept) throw new Error('Department not found.')

      const { error } = await supabase
        .from('departments')
        .update({
          status: 'active',
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error

      set({
        departments: get().departments.map(d =>
          d.id === id ? { ...d, status: 'active' } : d
        ),
        isLoading: false,
      })

      logActivity({
        action: 'STATUS_CHANGE',
        targetType: 'organization',
        targetId: id,
        targetName: dept.name,
        description: `Department "${dept.name}" reactivated`,
        previousValue: 'inactive',
        newValue: 'active',
        organization_id: orgId,
      })

      toast.success(`Department "${dept.name}" has been reactivated.`)
    } catch (err: any) {
      set({ isLoading: false })
      toast.error(err.message || 'Failed to reactivate department.')
      throw err
    }
  },

  // ---------------------------------------------------------------------------
  // Settings & Configuration
  // ---------------------------------------------------------------------------
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
      console.warn('[DepartmentStore] fetchDepartmentSettings:', err.message)
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
      toast.success('Operational capacity settings saved.')
    } catch (err: any) {
      toast.error('Failed to update settings: ' + err.message)
    }
  },

  // ---------------------------------------------------------------------------
  // KPI Management
  // ---------------------------------------------------------------------------
  fetchDepartmentKPIs: async (deptId) => {
    try {
      const { data, error } = await supabase
        .from('department_kpis')
        .select('*')
        .eq('department_id', deptId)

      if (error) throw error
      set({ activeKPIs: data || [] })
    } catch (err: any) {
      console.warn('[DepartmentStore] fetchDepartmentKPIs:', err.message)
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
        activeKPIs: get().activeKPIs.map(k =>
          k.id === kpiId ? { ...k, current_value: value } : k
        ),
      })
    } catch (err: any) {
      console.error('[DepartmentStore] syncKPIValue:', err.message)
    }
  },

  createDepartmentKPI: async (deptId, kpi) => {
    try {
      const { data, error } = await supabase
        .from('department_kpis')
        .insert({ ...kpi, department_id: deptId })
        .select()
        .single()

      if (error) throw error
      set({ activeKPIs: [...get().activeKPIs, data] })
      toast.success('KPI registered in operational catalog.')
    } catch (err: any) {
      toast.error('Failed to register KPI: ' + err.message)
    }
  },

  // ---------------------------------------------------------------------------
  // Dashboard Configuration
  // ---------------------------------------------------------------------------
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
      console.warn('[DepartmentStore] fetchDepartmentDashboard:', err.message)
    }
  },

  updateDepartmentDashboardLayout: async (deptId, layout, widgets) => {
    try {
      const { data, error } = await supabase
        .from('department_dashboards')
        .update({ layout_config: layout, enabled_widgets: widgets })
        .eq('department_id', deptId)
        .select()
        .single()

      if (error) throw error
      set({ activeDashboard: data })
      toast.success('Dashboard layout workspace bound.')
    } catch (err: any) {
      toast.error('Failed to update layout: ' + err.message)
    }
  },

  // ---------------------------------------------------------------------------
  // Team Member Reassignment
  // ---------------------------------------------------------------------------
  reassignMember: async (profileId, newDeptId, isPrimary = true) => {
    try {
      const { departments } = get()

      // Check if the dept ID is a real UUID
      const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newDeptId)

      if (!isRealUUID) {
        // Legacy text-based fallback
        const dept = departments.find(d => d.id === newDeptId)
        if (!dept) throw new Error('Department not found')

        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ department: dept.name })
          .eq('id', profileId)

        if (profileErr) throw profileErr
        toast.success(`Department updated to "${dept.name}"`)
        return
      }

      // Normal path: use department_members table
      if (isPrimary) {
        await supabase
          .from('department_members')
          .delete()
          .eq('profile_id', profileId)
          .eq('is_primary', true)
      }

      const { error: upsertErr } = await supabase
        .from('department_members')
        .upsert(
          { department_id: newDeptId, profile_id: profileId, is_primary: isPrimary },
          { onConflict: 'department_id,profile_id' }
        )

      if (upsertErr) throw upsertErr

      toast.success('Team member department reassignment completed.')
    } catch (err: any) {
      console.error('[DepartmentStore] reassignMember:', err)
      toast.error('Failed to reassign team member: ' + err.message)
    }
  },
}))
