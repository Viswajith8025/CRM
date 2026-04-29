import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { Contact as Lead } from './types'

interface CRMState {
  leads: Lead[]
  isLoading: boolean
  error: string | null
  fetchLeads: () => Promise<void>
  addLead: (lead: Partial<Lead>) => Promise<void>
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
}

export const useCRMStore = create<CRMState>((set, get) => ({
  leads: [],
  isLoading: false,
  error: null,

  fetchLeads: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ leads: data as Lead[], error: null })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  addLead: async (lead) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single()
      
      if (error) throw error
      set({ leads: [data as Lead, ...get().leads] })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  updateLead: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      set({
        leads: get().leads.map((l) => (l.id === id ? (data as Lead) : l))
      })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  deleteLead: async (id) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
      set({ leads: get().leads.filter((l) => l.id !== id) })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  }
}))
