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
  updatePayroll: (id: string, updates: any) => Promise<void>
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
        .select('*, profile:profiles!leave_requests_user_profile_fk_v2(full_name, avatar_url, status), leave_type:leave_types(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        console.error("fetchLeaves Supabase Error:", error)
        throw error
      }
      set({ leaves: data || [], error: null })
    } catch (err) {
      console.error("fetchLeaves catch block:", err)
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
        .select(`
          *,
          user_roles (
            roles:role_id ( id, name )
          ),
          department_members (
            is_primary,
            departments:department_id ( id, name )
          )
        `, { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<any>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      const mapped = result.data.map((m: any) => {
        const userRole = m.user_roles?.[0]
        const primaryDeptMember = m.department_members?.find((dm: any) => dm.is_primary) || m.department_members?.[0]
        return {
          ...m,
          designation: userRole?.roles?.name || m.role || null,
          department: primaryDeptMember?.departments?.name || null,
          user_roles: undefined,
          department_members: undefined,
        }
      })

      set(state => ({ 
        employees: mapped, 
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
      const { profile, session } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...employee, organization_id: orgId }
      
      const { data, error } = await supabase.functions.invoke('invite-employee', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      })

      if (error) {
         console.error('Edge function error:', error)
         throw new Error(error.message || 'Failed to invite user')
      }
      
      if (data?.error) {
         throw new Error(data.error)
      }

      // Refresh employees list to get the updated DB record with the correct UUID
      get().fetchEmployees({ force: true } as any)
    } catch (err) {
      throw toFriendlyError(err, "Failed to create employee profile. Make sure the edge function is deployed.")
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

      // HP-04 FIX: Require an explicit UUID. The ILIKE fuzzy fallback has been
      // removed because partial string matching (e.g. "Casual" matching
      // "Casual Leave (Half Day)") can silently deduct from the wrong leave
      // type balance. The LeaveRequestForm must always pass leave_type_id.
      const typeId = request.leave_type_id
      if (!typeId) {
        throw new Error(
          "A valid leave type must be selected. Please choose a leave type from the dropdown before submitting."
        )
      }

      // Validate UUID format as an extra safety net
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_REGEX.test(typeId)) {
        throw new Error("Invalid leave type selection. Please re-select the leave type and try again.")
      }

      if (!request.start_date || !request.end_date) {
        throw new Error("Start date and end date are required.")
      }

      if (new Date(request.end_date) < new Date(request.start_date)) {
        throw new Error("End date cannot be before start date.")
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
        .limit(200)

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
  },

  updatePayroll: async (id: string, updates: any) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('payroll')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select('*, profile:profiles(full_name, status, avatar_url)')
        .single()

      if (error) throw error
      set({
        payroll: get().payroll.map(p => p.id === id ? data as PayrollRecord : p)
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update payroll record.")
    }
  }
}))

