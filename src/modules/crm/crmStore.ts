import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Contact as Lead, Client, Interaction, Proposal } from '../types'
import { useWorkflowStore } from '@/modules/admin'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import { parseClientMetadata, serializeClientMetadata } from '@/lib/metadataFallback'

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
    leads: { totalCount: number, page: number, limit: number, totalPages: number }
    clients: { totalCount: number, page: number, limit: number, totalPages: number }
    proposals: { totalCount: number, page: number, limit: number, totalPages: number }
  }
  
  fetchLeads: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  addLead: (lead: Partial<Lead>) => Promise<void>
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  
  fetchClients: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  addClient: (client: Partial<Client>) => Promise<void>
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>
  deleteClient: (id: string) => Promise<void>

  fetchInteractions: (leadId: string) => Promise<void>
  addInteraction: (interaction: Partial<Interaction>) => Promise<void>
  
  fetchProposals: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  getProposalById: (id: string) => Promise<Proposal | null>
  addProposal: (proposal: Partial<Proposal>) => Promise<Proposal>
  updateProposal: (id: string, updates: Partial<Proposal>) => Promise<Proposal>
  signProposal: (id: string, signatureData: { name: string, signature: string }) => Promise<void>
  
  ensureClientFromLead: (leadId: string) => Promise<string>
  
  subscribeToLeads: () => () => void
  subscribeToClients: () => () => void
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
    leads: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
    clients: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
    proposals: { totalCount: 0, page: 1, limit: 20, totalPages: 0 }
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
        .is('deleted_at', null)

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
          ...get().pagination,
          leads: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
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
      
      // Strip any fields not in the DB schema (prevents 400 on schema mismatch)
      const { job_title, ...cleanLead } = lead as any;
      const LEAD_DB_COLUMNS = ['first_name','last_name','email','phone','company','status','source',
        'segment','score','value','next_follow_up','last_contacted_at','assigned_to',
        'requirement','brought_by_id','remarks','organization_id']
      const safeLead = Object.fromEntries(
        Object.entries(cleanLead).filter(([k]) => LEAD_DB_COLUMNS.includes(k))
      )
      if (safeLead.email === "") safeLead.email = null;
      if (safeLead.phone === "") safeLead.phone = null;
      if (!safeLead.brought_by_id) delete safeLead.brought_by_id;
      
      const leadWithOrg = { ...safeLead, organization_id: orgId }

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

      const currentLead = get().leads.find(l => l.id === id)
      
      const LEAD_DB_COLUMNS = ['first_name','last_name','email','phone','company','status','source',
        'segment','score','value','next_follow_up','last_contacted_at','assigned_to',
        'requirement','brought_by_id','remarks']
      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([k]) => LEAD_DB_COLUMNS.includes(k))
      ) as Partial<Lead>

      let query = supabase
        .from('leads')
        .update(safeUpdates)
        .eq('id', id)
        .eq('organization_id', orgId)

      const { data, error } = await query.select().single()

      if (error) {
        throw error
      }

      logActivity({
        action: updates.status ? 'STATUS_CHANGE' : 'UPDATE',
        targetType: 'lead',
        targetId: id,
        targetName: `${data.first_name} ${data.last_name}`,
        description: updates.status ? `Lead status changed to ${updates.status}` : `Updated lead details`,
        organization_id: orgId
      })

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

      const { error } = await supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)
      if (error) throw error

      set({ leads: get().leads.filter((l) => l.id !== id), error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: toFriendlyError(err, "Failed to delete lead.").message })
    }
  },

  fetchClients: async (params = {}) => {
    const { force = false, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = params
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && hasFetched && isFresh && get().clients.length > 0 && page === get().pagination.clients.page) return

    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const baseQuery = supabase
        .from('clients')
        .select('*, leads!lead_id(status)', { count: 'exact' })
        .eq('organization_id', orgId)
        .is('deleted_at', null)

      const result = await fetchPaginatedData<Client>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      // We still filter for active_client on the client-side for now, 
      // but the base query is now paginated on the server.
      const processedData = (result.data as any[] || []).filter(client => {
        if (!client.lead_id) return true
        return client.leads?.status === 'active_client'
      }).map(client => {
        const metadata = parseClientMetadata(client)
        return {
          ...client,
          department_id: metadata.department_id,
          team_lead_id: metadata.team_lead_id,
          address: metadata.cleanAddress
        }
      })

      set({ 
        clients: processedData, 
        pagination: {
          ...get().pagination,
          clients: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
        },
        error: null, 
        hasFetched: true, 
        lastFetchedAt: Date.now() 
      })
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
      
      const { isVirtual, department_id, team_lead_id, ...dbClient } = client as any
      const processedClient = serializeClientMetadata(dbClient, department_id || null, team_lead_id || null)
      const clientWithOrg = { ...processedClient, organization_id: orgId }
      
      const { data, error } = await supabase
        .from('clients')
        .insert(clientWithOrg)
        .select()
        .single()

      if (error) throw error
      
      const parsedData = {
        ...data,
        ...parseClientMetadata(data)
      }
      
      set({ clients: [parsedData as Client, ...get().clients], error: null, lastFetchedAt: Date.now() })
      useWorkflowStore.getState().executeWorkflow('CLIENT_CREATED', parsedData)
    } catch (err) {
      throw toFriendlyError(err, "Failed to add client.")
    }
  },

  updateClient: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const currentClient = get().clients.find(c => c.id === id)
      const { department_id, team_lead_id, ...cleanUpdates } = updates as any

      const fullClient = {
        ...(currentClient || {}),
        ...cleanUpdates
      }
      
      const processedClient = serializeClientMetadata(
        fullClient, 
        department_id !== undefined ? department_id : (currentClient as any)?.department_id, 
        team_lead_id !== undefined ? team_lead_id : (currentClient as any)?.team_lead_id
      )

      const finalUpdates = {
        ...cleanUpdates,
        address: processedClient.address,
        ...( ('department_id' in processedClient) ? { department_id: processedClient.department_id, team_lead_id: processedClient.team_lead_id } : {} )
      }

      let query = supabase
        .from('clients')
        .update(finalUpdates)
        .eq('id', id)
        .eq('organization_id', orgId)

      const { data, error } = await query.select().single()

      if (error) {
        throw error
      }

      const parsedData = {
        ...data,
        ...parseClientMetadata(data)
      }

      set({ clients: get().clients.map((c) => (c.id === id ? (parsedData as Client) : c)), error: null })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update client.")
    }
  },

  deleteClient: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      // Soft delete to preserve financial and audit history, as hard deletes might be blocked
      const { error } = await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)

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

  fetchProposals: async (params = {}) => {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = params
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const baseQuery = supabase
        .from('proposals')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<Proposal>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set({ 
        proposals: result.data,
        pagination: {
          ...get().pagination,
          proposals: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
        }
      })
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
      if (!orgId || !profile) throw new Error("No organization context found.")

      const { data: clientId, error } = await supabase
        .rpc('convert_lead_to_client', {
          p_lead_id: leadId,
          p_org_id: orgId,
          p_converted_by: profile.id
        })

      if (error) throw error
      
      // Refresh local state
      get().fetchLeads({ force: true })
      get().fetchClients({ force: true })
      
      return clientId
    } catch (err) {
      console.error("Error converting lead to client:", err)
      throw err
    }
  },

  subscribeToLeads: () => {
    let channel: any = null;
    import('@/store/useAuthStore').then(({ useAuthStore }) => {
      const orgId = useAuthStore.getState().profile?.organization_id
      if (!orgId) return

      channel = supabase
        .channel(`crm_leads_sync_${orgId}_${Math.random()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leads', filter: `organization_id=eq.${orgId}` },
          () => get().fetchLeads({ force: true })
        )
        .subscribe()
    })
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  },

  subscribeToClients: () => {
    let channel: any = null;
    import('@/store/useAuthStore').then(({ useAuthStore }) => {
      const orgId = useAuthStore.getState().profile?.organization_id
      if (!orgId) return

      channel = supabase
        .channel(`crm_clients_sync_${orgId}_${Math.random()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'clients', filter: `organization_id=eq.${orgId}` },
          () => get().fetchClients({ force: true })
        )
        .subscribe()
    })
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }
}))

