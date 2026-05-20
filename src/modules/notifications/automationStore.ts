import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { format, subDays, isBefore, addDays } from 'date-fns'
import { useNotificationsStore } from '@/modules/notifications'

interface AutomationState {
  isChecking: boolean
  lastCheckedAt: string | null
  runSmartReminders: () => Promise<void>
}

// The zero UUID is the default placeholder — never query with it, it will 400 or return wrong data
const NULL_ORG_ID = '00000000-0000-0000-0000-000000000000'

export interface AutomationLog {
  id: string
  automation_type: string
  status: string
  executed_at: string
  payload: any
  error_message: string
}

interface AutomationState {
  isChecking: boolean
  logs: AutomationLog[]
  runSmartReminders: () => Promise<void>
  fetchLogs: () => Promise<void>
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  isChecking: false,
  logs: [],

  runSmartReminders: async () => {
    set({ isChecking: true })
    try {
      // Trigger server-side automation RPCs
      const results = await Promise.all([
        supabase.rpc('process_overdue_invoices'),
        supabase.rpc('process_stale_leads')
      ])
      
      const errors = results.filter(r => r.error).map(r => r.error)
      if (errors.length > 0) {
        console.error('Automation RPC Failures:', errors)
      }
      
      await get().fetchLogs()
    } catch (err) {
      console.error('Automation Runtime Error:', err)
    } finally {
      set({ isChecking: false })
    }
  },

  fetchLogs: async () => {
    const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
    const orgId = profile?.organization_id
    if (!orgId) return

    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('organization_id', orgId)
      .order('executed_at', { ascending: false })
      .limit(50)

    if (!error) set({ logs: data })
  }
}))

