import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Contact as Lead } from './types'

const CACHE_TTL_MS = 5 * 60 * 1000

interface CRMState {
  leads: Lead[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAt: number | null
  fetchLeads: (force?: boolean) => Promise<void>
  addLead: (lead: Partial<Lead>) => Promise<void>
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
}

export const useCRMStore = create<CRMState>((set, get) => ({
  leads: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,

  fetchLeads: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && hasFetched && isFresh) return
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ leads: data as Lead[], error: null, hasFetched: true, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load leads.") })
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
      set({ leads: [data as Lead, ...get().leads], error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to add lead.")
      set({ error: friendlyError.message })
      throw friendlyError
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
        leads: get().leads.map((l) => (l.id === id ? (data as Lead) : l)),
        error: null,
        lastFetchedAt: Date.now(),
      })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update lead.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteLead: async (id) => {
    const previousLeads = get().leads
    const deletedLead = previousLeads.find((l) => l.id === id)
    const deletedIndex = previousLeads.findIndex((l) => l.id === id)

    set({ leads: previousLeads.filter((l) => l.id !== id) })

    try {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
      set({ error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to delete lead.")
      set((state) => {
        if (!deletedLead || state.leads.some((lead) => lead.id === id)) {
          return { error: friendlyError.message }
        }

        const leads = [...state.leads]
        leads.splice(Math.max(deletedIndex, 0), 0, deletedLead)
        return { leads, error: friendlyError.message }
      })
      throw friendlyError
    }
  }
}))
