import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { BDEReport } from '../crm/types'

interface BDEReportState {
  reports: BDEReport[]
  currentReport: BDEReport | null
  isLoading: boolean
  error: string | null
  
  fetchMyReportForToday: () => Promise<void>
  fetchMyReports: (startDate?: string, endDate?: string) => Promise<void>
  fetchAllReports: (startDate?: string, endDate?: string) => Promise<void>
  submitLoginForm: (reportData: Partial<BDEReport>) => Promise<void>
  submitLogoutForm: (reportData: Partial<BDEReport>) => Promise<void>
}

export const useBDEReportStore = create<BDEReportState>((set, get) => ({
  reports: [],
  currentReport: null,
  isLoading: false,
  error: null,

  fetchMyReportForToday: async () => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      if (!profile) return

      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('bde_daily_reports')
        .select('*')
        .eq('user_id', profile.id)
        .eq('report_date', today)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      
      set({ currentReport: data as BDEReport || null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load today's report.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchMyReports: async (startDate, endDate) => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      if (!profile) return

      let query = supabase
        .from('bde_daily_reports')
        .select('*')
        .eq('user_id', profile.id)
        .order('report_date', { ascending: false })

      if (startDate) query = query.gte('report_date', startDate)
      if (endDate) query = query.lte('report_date', endDate)
      if (!startDate && !endDate) query = query.limit(100)

      const { data, error } = await query

      if (error) throw error
      set({ reports: data as BDEReport[] })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load history.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchAllReports: async (startDate, endDate) => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      if (!profile || !['super_admin', 'admin', 'manager'].includes(profile.role)) return

      let query = supabase
        .from('bde_daily_reports')
        .select('*, users:profiles!user_id(full_name, email)')
        .eq('organization_id', profile.organization_id)
        .order('report_date', { ascending: false })

      if (startDate) query = query.gte('report_date', startDate)
      if (endDate) query = query.lte('report_date', endDate)
      if (!startDate && !endDate) query = query.limit(100)

      const { data, error } = await query

      if (error) throw error
      set({ reports: data as any[] }) // using any because we joined users
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load all reports.") })
    } finally {
      set({ isLoading: false })
    }
  },

  submitLoginForm: async (reportData) => {
    set({ isLoading: true, error: null })
    try {
      const { profile } = useAuthStore.getState()
      if (!profile) throw new Error("Not authenticated")

      const today = new Date().toISOString().split('T')[0]
      const payload = {
        ...reportData,
        organization_id: profile.organization_id,
        user_id: profile.id,
        report_date: today,
        status: 'active'
      }

      // Check if report already exists for today
      const { data: existing } = await supabase
        .from('bde_daily_reports')
        .select('id')
        .eq('user_id', profile.id)
        .eq('report_date', today)
        .maybeSingle()

      let result
      if (existing) {
        result = await supabase.from('bde_daily_reports').update(payload).eq('id', existing.id).select().single()
      } else {
        result = await supabase.from('bde_daily_reports').insert(payload).select().single()
      }

      if (result.error) throw result.error
      set({ currentReport: result.data as BDEReport })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to submit login report.")
      set({ error: friendlyError.message })
      throw friendlyError
    } finally {
      set({ isLoading: false })
    }
  },

  submitLogoutForm: async (reportData) => {
    set({ isLoading: true, error: null })
    try {
      const { currentReport } = get()
      if (!currentReport) throw new Error("No active login report found for today. Please submit login report first.")

      const payload = {
        ...reportData,
        status: 'completed'
      }

      const { data, error } = await supabase
        .from('bde_daily_reports')
        .update(payload)
        .eq('id', currentReport.id)
        .select()
        .single()

      if (error) throw error
      set({ currentReport: data as BDEReport })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to submit logout report.")
      set({ error: friendlyError.message })
      throw friendlyError
    } finally {
      set({ isLoading: false })
    }
  }
}))
