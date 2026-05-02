import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Contact as Lead, Client, Interaction, Proposal } from './types'

const CACHE_TTL_MS = 5 * 60 * 1000

interface CRMState {
  leads: Lead[]
  clients: Client[]
  interactions: Record<string, Interaction[]>
  proposals: Proposal[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAt: number | null
  
  fetchLeads: (force?: boolean) => Promise<void>
  addLead: (lead: Partial<Lead>) => Promise<void>
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  
  fetchClients: (force?: boolean) => Promise<void>
  addClient: (client: Partial<Client>) => Promise<void>
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>
  deleteClient: (id: string) => Promise<void>

  fetchInteractions: (leadId: string) => Promise<void>
  addInteraction: (interaction: Partial<Interaction>) => Promise<void>
  
  fetchProposals: (force?: boolean) => Promise<void>
  addProposal: (proposal: Partial<Proposal>) => Promise<void>
  updateProposal: (id: string, updates: Partial<Proposal>) => Promise<void>
}

export const useCRMStore = create<CRMState>((set, get) => ({
  leads: [],
  clients: [],
  interactions: {},
  proposals: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,

  fetchLeads: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = false // Force fresh fetch
    if (!force && hasFetched && isFresh) return
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      
      console.log('Fetch Leads Debug:', { count: data?.length, error })

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
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const leadWithOrg = { ...lead, organization_id: profile?.organization_id }
      
      const { data, error } = await supabase
        .from('leads')
        .insert(leadWithOrg)
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
      
      // If lead is Closed Won, automatically create a client record if it doesn't exist
      if (updates.status === 'closed_won' || data.status === 'closed_won') {
        const lead = data as Lead
        // Check if client already exists to avoid duplicates
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('email', lead.email)
          .maybeSingle()

        if (!existingClient && lead.email) {
          await get().addClient({
            name: `${lead.first_name} ${lead.last_name || ''}`.trim() || lead.company || 'Unknown',
            email: lead.email,
            contract_value: lead.value,
            service: 'Lead Conversion',
            user_id: lead.user_id,
            lead_id: lead.id
          })
        }
      }

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
  },

  fetchClients: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
    console.log('Fetch Clients Debug - Org ID:', profile?.organization_id)
    const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && hasFetched && isFresh && get().clients.length > 0) return
    set({ isLoading: true })
    try {
      // Fetch actual clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (clientsError) throw clientsError

      // Also fetch leads with status 'closed_won' to show them as potential clients
      const { data: wonLeadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'closed_won')

      if (leadsError) throw leadsError

      // Map won leads to client structure for uniform display
      const wonLeadsAsClients: Client[] = (wonLeadsData || []).map(lead => ({
        id: lead.id, 
        user_id: lead.user_id,
        lead_id: lead.id,
        name: `${lead.first_name} ${lead.last_name || ''}`.trim() || lead.company || 'Converted Lead',
        email: lead.email,
        phone: null,
        address: null,
        website: null,
        service: 'Lead Conversion',
        contract_value: lead.value,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        isVirtual: true
      }))

      // Combine and filter out duplicates
      const allClients = [...(clientsData as Client[])]
      
      // Map for quick lookup of which leads already have real client records
      const existingLeadIds = new Set(allClients.map(c => c.lead_id).filter(Boolean))
      const existingEmails = new Set(allClients.map(c => c.email?.toLowerCase()).filter(Boolean))

      wonLeadsAsClients.forEach(leadClient => {
        const isAlreadyLinked = leadClient.lead_id && existingLeadIds.has(leadClient.lead_id)
        const isDuplicateEmail = leadClient.email && existingEmails.has(leadClient.email.toLowerCase())
        
        // Only skip if explicitly linked by ID or if email matches a record WITHOUT a lead_id
        if (!isAlreadyLinked && !isDuplicateEmail) {
          allClients.push(leadClient)
        }
      })

      set({ clients: allClients, error: null, hasFetched: true, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load clients.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addClient: async (client) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      
      // Clean the data: Remove frontend-only properties like 'isVirtual'
      const { isVirtual, ...dbClient } = client as any
      const clientWithOrg = { ...dbClient, organization_id: profile?.organization_id }
      
      const { data, error } = await supabase
        .from('clients')
        .insert(clientWithOrg)
        .select()
        .single()

      if (error) throw error
      set({ clients: [data as Client, ...get().clients], error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to add client.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateClient: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set({
        clients: get().clients.map((c) => (c.id === id ? (data as Client) : c)),
        error: null,
        lastFetchedAt: Date.now(),
      })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update client.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteClient: async (id) => {
    const previousClients = get().clients
    set({ clients: previousClients.filter((c) => c.id !== id) })
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      set({ error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to delete client.")
      set({ clients: previousClients, error: friendlyError.message })
      throw friendlyError
    }
  },

  fetchInteractions: async (leadId) => {
    try {
      const { data, error } = await supabase
        .from('lead_interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ 
        interactions: { 
          ...get().interactions, 
          [leadId]: data as Interaction[] 
        } 
      })
    } catch (err) {
      console.error("Error fetching interactions:", err)
    }
  },

  addInteraction: async (interaction) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { 
        ...interaction, 
        organization_id: profile?.organization_id,
        user_id: profile?.id
      }
      
      const { data, error } = await supabase
        .from('lead_interactions')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      
      const leadId = data.lead_id
      set({ 
        interactions: { 
          ...get().interactions, 
          [leadId]: [data as Interaction, ...(get().interactions[leadId] || [])] 
        } 
      })
      
      // Update last_contacted_at on the lead
      await get().updateLead(leadId, { last_contacted_at: new Date().toISOString() })
    } catch (err) {
      console.error("Error adding interaction:", err)
      throw err
    }
  },

  fetchProposals: async (force = false) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ proposals: data as Proposal[] })
    } catch (err) {
      console.error("Error fetching proposals:", err)
    } finally {
      set({ isLoading: false })
    }
  },

  addProposal: async (proposal) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { 
        ...proposal, 
        organization_id: profile?.organization_id,
        user_id: profile?.id
      }
      
      const { data, error } = await supabase
        .from('proposals')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      set({ proposals: [data as Proposal, ...get().proposals] })
    } catch (err) {
      console.error("Error adding proposal:", err)
      throw err
    }
  },

  updateProposal: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set({
        proposals: get().proposals.map((p) => (p.id === id ? (data as Proposal) : p))
      })
    } catch (err) {
      console.error("Error updating proposal:", err)
      throw err
    }
  }
}))
