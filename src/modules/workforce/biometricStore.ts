import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface BiometricDevice {
  id: string
  organization_id: string
  device_name: string
  serial_number: string
  ip_address: string | null
  location: string | null
  status: 'online' | 'offline' | 'maintenance'
  last_sync_at: string | null
}

export interface BiometricLog {
  id: string
  employee_id: string
  device_id: string | null
  punch_time: string
  punch_type: 'IN' | 'OUT' | 'UNKNOWN'
  verification_mode: string
  is_processed: boolean
  created_at: string
}

export interface AttendanceSession {
  id: string
  employee_id: string
  session_date: string
  first_punch_in: string | null
  last_punch_out: string | null
  total_work_minutes: number
  overtime_minutes: number
  status: 'active' | 'closed' | 'incomplete' | 'anomaly'
  is_late: boolean
  is_half_day: boolean
}

export interface AttendanceCorrection {
  id: string
  employee_id: string
  session_id: string
  requested_punch_in: string | null
  requested_punch_out: string | null
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  created_at: string
}

interface BiometricStoreState {
  devices: BiometricDevice[]
  recentLogs: BiometricLog[]
  activeSessions: AttendanceSession[]
  pendingCorrections: AttendanceCorrection[]
  isLoading: boolean
  
  // Actions
  fetchDevices: () => Promise<void>
  fetchActiveSessions: (date: string) => Promise<void>
  fetchPendingCorrections: () => Promise<void>
  requestCorrection: (payload: Partial<AttendanceCorrection>) => Promise<void>
  approveCorrection: (correctionId: string) => Promise<void>
  rejectCorrection: (correctionId: string, reason: string) => Promise<void>
}

export const useBiometricStore = create<BiometricStoreState>((set, get) => ({
  devices: [],
  recentLogs: [],
  activeSessions: [],
  pendingCorrections: [],
  isLoading: false,

  fetchDevices: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('biometric_devices')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('device_name')

      if (error) throw error
      set({ devices: data as BiometricDevice[] })
    } catch (err) {
      console.error('Failed to fetch biometric devices:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchActiveSessions: async (date: string) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*, profiles(full_name, avatar_url, department_id)')
        .eq('organization_id', profile.organization_id)
        .eq('session_date', date)
        .order('first_punch_in', { ascending: false })

      if (error) throw error
      set({ activeSessions: data as any[] })
    } catch (err) {
      console.error('Failed to fetch active attendance sessions:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchPendingCorrections: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) return

      const { data, error } = await supabase
        .from('attendance_corrections')
        .select('*, profiles(full_name), attendance_sessions(session_date, first_punch_in, last_punch_out)')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ pendingCorrections: data as any[] })
    } catch (err) {
      console.error('Failed to fetch pending corrections:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  requestCorrection: async (payload) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('attendance_corrections')
        .insert([{
          organization_id: profile.organization_id,
          employee_id: profile.id,
          ...payload
        }])

      if (error) throw error
    } catch (err) {
      console.error('Failed to request correction:', err)
      throw err
    }
  },

  approveCorrection: async (correctionId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) throw new Error('Not authenticated')

      // Enterprise Note: In a real system, this would be an RPC to ensure atomic operations
      // mapping the correction directly over the attendance_session securely.
      const { error } = await supabase
        .from('attendance_corrections')
        .update({ 
          status: 'approved', 
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', correctionId)

      if (error) throw error

      set({
        pendingCorrections: get().pendingCorrections.filter(c => c.id !== correctionId)
      })
    } catch (err) {
      console.error('Failed to approve correction:', err)
      throw err
    }
  },

  rejectCorrection: async (correctionId, reason) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile?.organization_id) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('attendance_corrections')
        .update({ 
          status: 'rejected', 
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          reviewer_note: reason
        })
        .eq('id', correctionId)

      if (error) throw error

      set({
        pendingCorrections: get().pendingCorrections.filter(c => c.id !== correctionId)
      })
    } catch (err) {
      console.error('Failed to reject correction:', err)
      throw err
    }
  }
}))
