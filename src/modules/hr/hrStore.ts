import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toFriendlyError, getFriendlySupabaseError } from '@/lib/supabaseError'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { Employee, LeaveRequest, PayrollRecord } from '../types/types'

interface HRState {
  employees: Employee[]
  payroll: PayrollRecord[]
  attendance: any[]
  leaves: any[]
  isLoading: boolean
  error: string | null
  pagination: {
    employees: { totalCount: number, page: number, limit: number, totalPages: number }
    leaveRequests: { totalCount: number, page: number, limit: number, totalPages: number }
  }
  
  fetchAttendance: () => Promise<void>
  fetchLeaves: () => Promise<void>
  clockIn: () => Promise<void>
  clockOut: (attendanceId: string) => Promise<void>
  fetchEmployees: (params?: Partial<PaginationParams>) => Promise<void>
  addEmployee: (employee: Partial<Employee>) => Promise<void>
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>
  
  fetchLeaveRequests: (params?: Partial<PaginationParams>) => Promise<void>
  submitLeaveRequest: (request: Partial<LeaveRequest>) => Promise<void>
  updateLeaveStatus: (id: string, status: LeaveRequest['status']) => Promise<void>
  
  fetchPayroll: () => Promise<void>
  generatePayroll: (payload: any) => Promise<void>
}

export const useHRStore = create<HRState>((set, get) => ({
  employees: [],
  payroll: [],
  attendance: [],
  leaves: [],
  isLoading: false,
  error: null,
  pagination: {
    employees: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
    leaveRequests: { totalCount: 0, page: 1, limit: 20, totalPages: 0 }
  },

  fetchAttendance: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('attendance')
        .select('*, profile:profiles(full_name, avatar_url, status)')
        .eq('organization_id', orgId)
        .order('date', { ascending: false })
        .limit(20)

      if (error) throw error
      set({ attendance: data || [], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err) })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchLeaves: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, profile:profiles(full_name, avatar_url, status)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ leaves: data || [], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err) })
    } finally {
      set({ isLoading: false })
    }
  },

  clockIn: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.id) return

      const { error } = await supabase.from('attendance').insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        date: new Date().toISOString().split('T')[0],
        clock_in: new Date().toISOString(),
        status: 'present'
      })

      if (error) throw error
      get().fetchAttendance()
    } catch (err) {
      console.error("Clock in failed:", err)
    }
  },

  clockOut: async (attendanceId) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', attendanceId)

      if (error) throw error
      get().fetchAttendance()
    } catch (err) {
      console.error("Clock out failed:", err)
    }
  },

  fetchEmployees: async (params = {}) => {
    const { page = 1, limit = 20, sortBy = 'full_name', sortOrder = 'asc', filters = {} } = params
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const baseQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<Employee>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set(state => ({ 
        employees: result.data, 
        pagination: {
          ...state.pagination,
          employees: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
        },
        error: null 
      }))
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load employees.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addEmployee: async (employee) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...employee, organization_id: orgId }
      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      set({ employees: [...get().employees, data as Employee] })
    } catch (err) {
      throw toFriendlyError(err, "Failed to create employee profile.")
    }
  },

  updateEmployee: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error
      set({
        employees: get().employees.map((e) => (e.id === id ? (data as Employee) : e))
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update profile.")
    }
  },

  fetchLeaveRequests: async (params = {}) => {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = params
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const baseQuery = supabase
        .from('leave_requests')
        .select('*, profile:profiles(full_name)', { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<LeaveRequest>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set(state => ({ 
        leaveRequests: result.data,
        pagination: {
          ...state.pagination,
          leaveRequests: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
        }
      }))
    } catch (err) {
      console.error("Failed to fetch leave requests:", err)
    }
  },

  submitLeaveRequest: async (request) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")
      
      let typeId = request.leave_type_id
      if (!typeId && (request as any).leave_type) {
        // Fallback for older forms that pass the string name instead of the UUID
        const { data: typeData } = await supabase
          .from('leave_types')
          .select('id')
          .ilike('name', `%${(request as any).leave_type}%`)
          .limit(1)
          .single()
        
        if (typeData) {
          typeId = typeData.id
        }
      }

      const { error } = await supabase.from('leave_requests').insert({
        organization_id: orgId,
        user_id: profile.id,
        leave_type_id: typeId,
        start_date: request.start_date,
        end_date: request.end_date,
        reason: request.reason,
        is_emergency: request.is_emergency || false,
        status: 'pending'
      })

      if (error) throw error
      
      // Update local state by re-fetching to ensure relations are loaded
      get().fetchLeaves()
      get().fetchLeaveRequests()
    } catch (err) {
      throw toFriendlyError(err, "Failed to submit leave request.")
    }
  },

  updateLeaveStatus: async (id, status) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('leave_requests')
        .update({ status })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error
      
      // Insert approval trail record
      if (profile?.id) {
        await supabase.from('leave_request_actions').insert({
          leave_request_id: id,
          actor_id: profile.id,
          action: status,
          note: `Status changed to ${status}`
        })
      }
      set({
        leaves: get().leaves.map((r) => (r.id === id ? { ...r, status } : r))
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update leave status.")
    }
  },

  fetchPayroll: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('payroll')
        .select('*, profile:profiles(full_name, status, avatar_url)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ payroll: data as PayrollRecord[] })
    } catch (err) {
      console.error("Failed to fetch payroll:", err)
    }
  },

  generatePayroll: async (payload: any) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('payroll')
        .insert({ ...payload, organization_id: orgId })
        .select()
        .single()

      if (error) throw error
      set({ payroll: [data as PayrollRecord, ...get().payroll] })
    } catch (err) {
      console.error("Failed to generate payroll:", err)
    }
  }
}))

