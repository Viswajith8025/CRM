import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { HREmployee, HRAttendance, HRLeave, HRPayroll } from './types'

interface HRState {
  employees: HREmployee[]
  attendance: HRAttendance[]
  leaves: HRLeave[]
  payroll: HRPayroll[]
  isLoading: boolean
  error: string | null

  // Fetch Methods
  fetchEmployees: () => Promise<void>
  fetchAttendance: (dateFilter?: string) => Promise<void>
  fetchLeaves: () => Promise<void>
  fetchPayroll: (month?: string, year?: number) => Promise<void>

  // Mutate Methods
  updateEmployee: (id: string, updates: Partial<HREmployee>) => Promise<void>
  clockIn: () => Promise<void>
  clockOut: (id: string) => Promise<void>
  submitLeave: (leave: Partial<HRLeave>) => Promise<void>
  updateLeaveStatus: (id: string, status: 'approved' | 'rejected') => Promise<void>
  generatePayroll: (payroll: Partial<HRPayroll>) => Promise<void>
}

export const useHRStore = create<HRState>((set, get) => ({
  employees: [],
  attendance: [],
  leaves: [],
  payroll: [],
  isLoading: false,
  error: null,

  fetchEmployees: async () => {
    set({ isLoading: true })
    try {
      // 1. Fetch all profiles that should be in HR
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['employee', 'manager', 'admin'])

      if (profilesError) throw profilesError

      // 2. Fetch existing HR data
      const { data: hrData, error: hrError } = await supabase
        .from('hr_employees')
        .select('*')

      if (hrError) throw hrError

      // 3. Merge: Every eligible profile gets an HR entry (even if empty)
      const mergedEmployees = profiles.map(profile => {
        const hrRecord = hrData.find(hr => hr.user_id === profile.id)
        return {
          id: hrRecord?.id || `temp-${profile.id}`,
          user_id: profile.id,
          department: hrRecord?.department || "Unassigned",
          designation: hrRecord?.designation || (profile.role === 'admin' ? "Administrator" : "Staff"),
          base_salary: hrRecord?.base_salary || 0,
          kpi_score: hrRecord?.kpi_score || 0,
          join_date: hrRecord?.join_date || profile.created_at,
          profile: profile
        }
      })

      set({ employees: mergedEmployees as HREmployee[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load employees.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchAttendance: async (dateFilter) => {
    set({ isLoading: true })
    try {
      let query = supabase.from('hr_attendance').select('*, profile:profiles(*)')
      if (dateFilter) {
        query = query.eq('date', dateFilter)
      }
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      set({ attendance: data as HRAttendance[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load attendance.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchLeaves: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('hr_leaves')
        .select('*, profile:profiles(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      set({ leaves: data as HRLeave[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load leaves.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchPayroll: async (month, year) => {
    set({ isLoading: true })
    try {
      let query = supabase.from('hr_payroll').select('*, profile:profiles(*)')
      if (month) query = query.eq('month', month)
      if (year) query = query.eq('year', year)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      set({ payroll: data as HRPayroll[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load payroll.") })
    } finally {
      set({ isLoading: false })
    }
  },

  updateEmployee: async (userId, updates) => {
    try {
      const { profile: authProfile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      
      // Remove any temporary ID or profile object from updates
      const { id, profile, ...cleanUpdates } = updates as any

      const { error } = await supabase
        .from('hr_employees')
        .upsert({ 
          ...cleanUpdates, 
          user_id: userId,
          organization_id: authProfile?.organization_id 
        }, { onConflict: 'user_id' })
      
      if (error) throw error
      await get().fetchEmployees()
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  clockIn: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile) return

      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()

      const payload = {
        user_id: profile.id,
        date: today,
        clock_in: now,
        status: 'present',
        organization_id: profile.organization_id
      }

      const { data, error } = await supabase
        .from('hr_attendance')
        .insert(payload)
        .select('*, profile:profiles(*)')
        .single()
      
      if (error) throw error
      set(state => ({
        attendance: [data as HRAttendance, ...state.attendance]
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  clockOut: async (id) => {
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('hr_attendance')
        .update({ clock_out: now })
        .eq('id', id)
        .select('*, profile:profiles(*)')
        .single()
      
      if (error) throw error
      set(state => ({
        attendance: state.attendance.map(a => a.id === id ? (data as HRAttendance) : a)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  submitLeave: async (leave) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...leave, user_id: profile?.id, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('hr_leaves')
        .insert(payload)
        .select('*, profile:profiles(*)')
        .single()

      if (error) throw error
      set(state => ({
        leaves: [data as HRLeave, ...state.leaves]
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  updateLeaveStatus: async (id, status) => {
    try {
      const { data, error } = await supabase
        .from('hr_leaves')
        .update({ status })
        .eq('id', id)
        .select('*, profile:profiles(*)')
        .single()
      
      if (error) throw error
      set(state => ({
        leaves: state.leaves.map(l => l.id === id ? (data as HRLeave) : l)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  generatePayroll: async (payroll) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...payroll, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('hr_payroll')
        .insert(payload)
        .select('*, profile:profiles(*)')
        .single()

      if (error) throw error
      set(state => ({
        payroll: [data as HRPayroll, ...state.payroll]
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  }
}))
