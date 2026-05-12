import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Contact as Lead, Client, Interaction, Proposal } from '../types'
import { useWorkflowStore } from '@/modules/admin'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'

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
  virtualLeadStatusOverrides: Record<string, string>
  pagination: {
    totalCount: number
    page: number
    limit: number
    totalPages: number
  }
  
  fetchLeads: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
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
  getProposalById: (id: string) => Promise<Proposal | null>
  addProposal: (proposal: Partial<Proposal>) => Promise<Proposal>
  updateProposal: (id: string, updates: Partial<Proposal>) => Promise<Proposal>
  signProposal: (id: string, signatureData: { name: string, signature: string }) => Promise<void>
  
  ensureClientFromLead: (leadId: string) => Promise<string>
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
  virtualLeadStatusOverrides: {},
  pagination: {
    totalCount: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  },

  fetchLeads: async (params = {}) => {
    const { force = false, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = params
    
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const baseQuery = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<Lead>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set({ 
        leads: result.data, 
        pagination: {
          totalCount: result.totalCount,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        },
        error: null, 
        hasFetched: true, 
        lastFetchedAt: Date.now() 
      })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load leads.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addLead: async (lead) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")
      
      const { job_title, ...cleanLead } = lead as any;
      if (cleanLead.email === "") cleanLead.email = null;
      if (cleanLead.phone === "") cleanLead.phone = null;
      
      const leadWithOrg = { ...cleanLead, organization_id: orgId }

      const { data, error } = await supabase
        .from('leads')
        .insert(leadWithOrg)
        .select()
        .single()

      if (error) throw error

      logActivity({
        action: 'CREATE',
        targetType: 'lead',
        targetId: data.id,
        targetName: `${data.first_name} ${data.last_name}`,
        description: `New lead created: ${data.company || 'Individual'}`,
        organization_id: orgId
      })

      set({ leads: [data as Lead, ...get().leads], error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to add lead.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateLead: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      // Optimistic UI for status
      if (updates.status) {
        const overrides = id.startsWith('virtual-lead-') 
          ? { virtualLeadStatusOverrides: { ...get().virtualLeadStatusOverrides, [id]: updates.status } }
          : {}
        set((state) => ({
          leads: state.leads.map((l) => (l.id === id ? { ...l, status: updates.status! } : l)),
          ...overrides
        }))
      }

      // Handle Virtual Leads
      if (id.startsWith('virtual-lead-')) {
        const clientId = id.replace('virtual-lead-', '')
        const client = get().clients.find(c => c.id === clientId)
        
        if (client) {
          if (updates.status && updates.status !== 'active_client') {
            const names = (client.name || 'Client').split(' ')
            const { data: newLead, error: leadError } = await supabase
              .from('leads')
              .insert({
                first_name: names[0],
                last_name: names.slice(1).join(' ') || null,
                email: client.email,
                phone: client.phone || null,
                status: updates.status,
                value: client.contract_value || 0,
                organization_id: orgId
              })
              .select()
              .single()

            if (leadError) throw leadError

            await supabase
              .from('clients')
              .update({ lead_id: newLead.id })
              .eq('id', clientId)
              .eq('organization_id', orgId)
                
            set((state) => ({
              clients: state.clients.map(c => c.id === clientId ? { ...c, lead_id: newLead.id } : c),
              leads: state.leads.map(l => l.id === id ? (newLead as Lead) : l)
            }))
          } else {
            const clientUpdates: any = {}
            if (updates.first_name || updates.last_name) {
              clientUpdates.name = `${updates.first_name || ''} ${updates.last_name || ''}`.trim()
            }
            if (updates.email) clientUpdates.email = updates.email
            if (updates.value) clientUpdates.contract_value = updates.value

            if (Object.keys(clientUpdates).length > 0) {
              await get().updateClient(clientId, clientUpdates)
            }
            set((state) => ({
              leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l))
            }))
          }
        }
        return
      }

      const { job_title, ...cleanUpdates } = updates as any;
      if (cleanUpdates.email === "") cleanUpdates.email = null;
      if (cleanUpdates.phone === "") cleanUpdates.phone = null;

      const { data, error } = await supabase
        .from('leads')
        .update(cleanUpdates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error

      logActivity({
        action: updates.status ? 'STATUS_CHANGE' : 'UPDATE',
        targetType: 'lead',
        targetId: id,
        targetName: `${data.first_name} ${data.last_name}`,
        description: updates.status ? `Lead status changed to ${updates.status}` : `Updated lead details`,
        organization_id: orgId
      })

      // Sync name to client if linked
      if (updates.first_name || updates.last_name) {
        const fullName = `${updates.first_name || data.first_name} ${updates.last_name || data.last_name || ''}`.trim()
        await supabase
          .from('clients')
          .update({ name: fullName })
          .eq('lead_id', id)
          .eq('organization_id', orgId)
      }

      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? (data as Lead) : l)),
        error: null,
      }))
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update lead.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteLead: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      if (id.startsWith('virtual-lead-')) {
        const clientId = id.replace('virtual-lead-', '')
        await get().deleteClient(clientId)
        return
      }

      const { error } = await supabase.from('leads').delete().eq('id', id).eq('organization_id', orgId)
      if (error) throw error

      set({ leads: get().leads.filter((l) => l.id !== id), error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: toFriendlyError(err, "Failed to delete lead.").message })
    }
  },

  fetchClients: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && hasFetched && isFresh && get().clients.length > 0) return

    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*, leads!lead_id(status)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (clientsError) throw clientsError

      // Filter clients based on linked lead status (only active_client or no lead)
      const activeClients = (clientsData as any[] || []).filter(client => {
        if (!client.lead_id) return true
        return client.leads?.status === 'active_client'
      }) as Client[]

      set({ clients: activeClients, error: null, hasFetched: true, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load clients.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addClient: async (client) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")
      
      const { isVirtual, ...dbClient } = client as any
      const clientWithOrg = { ...dbClient, organization_id: orgId }
      
      const { data, error } = await supabase
        .from('clients')
        .insert(clientWithOrg)
        .select()
        .single()

      if (error) throw error
      set({ clients: [data as Client, ...get().clients], error: null, lastFetchedAt: Date.now() })
      useWorkflowStore.getState().executeWorkflow('CLIENT_CREATED', data)
    } catch (err) {
      throw toFriendlyError(err, "Failed to add client.")
    }
  },

  updateClient: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error
      set({ clients: get().clients.map((c) => (c.id === id ? (data as Client) : c)), error: null })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update client.")
    }
  },

  deleteClient: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase.from('clients').delete().eq('id', id).eq('organization_id', orgId)
      if (error) throw error
      set({ clients: get().clients.filter((c) => c.id !== id), error: null })
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete client.")
    }
  },

  fetchInteractions: async (leadId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('lead_interactions')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ interactions: { ...get().interactions, [leadId]: data as Interaction[] } })
    } catch (err) {
      console.error("Error fetching interactions:", err)
    }
  },

  addInteraction: async (interaction) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...interaction, organization_id: orgId, user_id: profile?.id }
      const { data, error } = await supabase.from('lead_interactions').insert(payload).select().single()
      if (error) throw error
      
      const leadId = data.lead_id
      set({ interactions: { ...get().interactions, [leadId]: [data as Interaction, ...(get().interactions[leadId] || [])] } })
      await get().updateLead(leadId, { last_contacted_at: new Date().toISOString() })
    } catch (err) {
      console.error("Error adding interaction:", err)
    }
  },

  fetchProposals: async (force = false) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ proposals: data as Proposal[] })
    } catch (err) {
      console.error("Error fetching proposals:", err)
    }
  },

  getProposalById: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return null

      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single()

      if (error) throw error
      return data as Proposal
    } catch (err) {
      console.error("Error fetching proposal:", err)
      return null
    }
  },

  addProposal: async (proposal) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...proposal, organization_id: orgId, user_id: profile?.id }
      const { data, error } = await supabase.from('proposals').insert(payload).select().single()
      if (error) throw error
      set({ proposals: [data as Proposal, ...get().proposals] })
      return data as Proposal
    } catch (err) {
      throw toFriendlyError(err, "Failed to add proposal.")
    }
  },

  updateProposal: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error
      set({ proposals: get().proposals.map((p) => (p.id === id ? (data as Proposal) : p)) })
      return data as Proposal
    } catch (err) {
      throw toFriendlyError(err, "Failed to update proposal.")
    }
  },

  signProposal: async (id, signatureData) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('proposals')
        .update({
          status: 'accepted',
          signed_at: new Date().toISOString(),
          signature_data: signatureData.signature,
          signer_name: signatureData.name
        })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()

      if (error) throw error
      set({ proposals: get().proposals.map((p) => (p.id === id ? (data as Proposal) : p)) })
    } catch (err) {
      throw toFriendlyError(err, "Failed to sign proposal.")
    }
  },

  ensureClientFromLead: async (leadId: string) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      // 1. Check if this is ALREADY a client ID (prevent double-conversion attempts)
      const { data: alreadyClient } = await supabase
        .from('clients')
        .select('id')
        .eq('id', leadId)
        .eq('organization_id', orgId)
        .maybeSingle()

      if (alreadyClient) return alreadyClient.id

      // 2. Check if a client exists for this lead_id
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('lead_id', leadId)
        .eq('organization_id', orgId)
        .maybeSingle()

      if (existing) return existing.id

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('organization_id', orgId)
        .single()

      if (!lead) throw new Error("Lead not found")

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: `${lead.first_name} ${lead.last_name || ''}`.trim() || lead.company || 'Converted Lead',
          email: lead.email,
          phone: lead.phone,
          lead_id: lead.id,
          organization_id: orgId,
          user_id: lead.user_id
        })
        .select()
        .single()

      if (error) throw error
      return newClient.id
    } catch (err) {
      console.error("Error ensuring client:", err)
      throw err
    }
  }
}))

