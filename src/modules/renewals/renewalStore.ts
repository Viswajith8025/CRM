import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'

export type RenewalCategory = 'hosting' | 'domain' | 'mail' | 'hosting_domain'
export type RenewalStatus = 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface Renewal {
  id: string
  created_at: string
  organization_id: string
  client_id: string
  project_id?: string
  category: RenewalCategory
  description: string
  amount: number
  expiry_date: string
  status: RenewalStatus
  reminders_sent: number
  last_reminder_at?: string
  client?: { name: string; email: string }
  project?: { name: string }
}

interface RenewalState {
  renewals: Renewal[]
  isLoading: boolean
  fetchRenewals: () => Promise<void>
  addRenewal: (renewal: Omit<Renewal, 'id' | 'created_at' | 'organization_id' | 'reminders_sent'>) => Promise<void>
  updateRenewal: (id: string, updates: Partial<Renewal>) => Promise<void>
  deleteRenewal: (id: string) => Promise<void>
  sendReminder: (renewal: Renewal) => Promise<void>
}

export const useRenewalStore = create<RenewalState>((set, get) => ({
  renewals: [],
  isLoading: false,

  fetchRenewals: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('renewals')
        .select('*, client:clients(name, email), project:projects(name)')
        .order('expiry_date', { ascending: true })

      if (error) throw error
      set({ renewals: data || [] })
    } catch (error: any) {
      toast.error('Failed to fetch renewals')
      console.error(error)
    } finally {
      set({ isLoading: false })
    }
  },

  addRenewal: async (renewal) => {
    const { profile } = useAuthStore.getState()
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from('renewals')
        .insert([{ ...renewal, organization_id: profile.organization_id }])
        .select()
        .single()

      if (error) throw error
      set({ renewals: [data, ...get().renewals] })
      toast.success('Renewal scheduled successfully')
    } catch (error: any) {
      toast.error('Failed to add renewal')
      console.error(error)
    }
  },

  updateRenewal: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('renewals')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      set({
        renewals: get().renewals.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      })
      toast.success('Renewal updated')
    } catch (error: any) {
      toast.error('Update failed')
      console.error(error)
    }
  },

  deleteRenewal: async (id) => {
    try {
      const { error } = await supabase.from('renewals').delete().eq('id', id)
      if (error) throw error
      set({ renewals: get().renewals.filter((r) => r.id !== id) })
      toast.success('Renewal record deleted')
    } catch (error: any) {
      toast.error('Deletion failed')
      console.error(error)
    }
  },

  sendReminder: async (renewal) => {
    try {
      // In a real app, this would trigger an Edge Function or Email Service
      // For now, we simulate and update the counter
      const { error } = await supabase
        .from('renewals')
        .update({ 
          reminders_sent: (renewal.reminders_sent || 0) + 1,
          last_reminder_at: new Date().toISOString(),
          status: 'sent'
        })
        .eq('id', renewal.id)

      if (error) throw error
      
      set({
        renewals: get().renewals.map((r) => 
          r.id === renewal.id 
            ? { ...r, reminders_sent: (r.reminders_sent || 0) + 1, status: 'sent', last_reminder_at: new Date().toISOString() } 
            : r
        ),
      })
      
      toast.success(`Reminder sent to ${renewal.client?.name}`)
    } catch (error: any) {
      toast.error('Failed to send reminder')
      console.error(error)
    }
  }
}))
