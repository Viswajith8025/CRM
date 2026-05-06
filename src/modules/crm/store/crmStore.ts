import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Contact as Lead, Client, Interaction, Proposal } from '../types'

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
  // Track status overrides for virtual leads so drag-and-drop persists across fetches
  virtualLeadStatusOverrides: Record<string, string>
  
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
  virtualLeadStatusOverrides: {},

  fetchLeads: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && hasFetched && isFresh && get().leads.length > 0) return
    set({ isLoading: true })
    try {
      // 1. Fetch real leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, 50)
      
      if (leadsError) throw leadsError

      // 2. Fetch all clients to ensure they appear as "Won" leads in the Kanban
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')

      if (clientsError) throw clientsError

      const leads = leadsData as Lead[]
      const clients = clientsData as Client[]

      // Create virtual leads for any client that doesn't have a lead record
      // or to ensure the names are perfectly synced in the UI
      const leadIds = new Set(leads.map(l => l.id))
      const clientLeads = clients.map(client => {
        // If this client is already linked to a lead in the list, 
        // we update that lead's name in memory for the UI sync
        const existingLead = leads.find(l => l.id === client.lead_id)
        if (existingLead) {
          const [first, ...rest] = client.name.split(' ')
          existingLead.first_name = first
          existingLead.last_name = rest.join(' ') || null
          return null
        }

        // If not linked, create a virtual lead so they appear in "Closed Won"
        const virtualId = `virtual-lead-${client.id}`
        const overriddenStatus = get().virtualLeadStatusOverrides[virtualId]
        return {
          id: virtualId,
          first_name: client.name.split(' ')[0],
          last_name: client.name.split(' ').slice(1).join(' ') || null,
          email: client.email,
          status: (overriddenStatus || 'closed_won') as any,
          value: client.contract_value || 0,
          company: 'Client',
          created_at: client.created_at,
          organization_id: client.organization_id
        } as Lead
      }).filter(Boolean) as Lead[]

      const finalLeads = [...leads, ...clientLeads]
      
      set({ leads: finalLeads, error: null, hasFetched: true, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load leads.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addLead: async (lead) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      
      // Strip fields that don't exist in the database schema to prevent 400 Bad Request
      const { job_title, ...cleanLead } = lead as any;
      
      // Convert empty strings to null for unique constraints
      if (cleanLead.email === "") cleanLead.email = null;
      if (cleanLead.phone === "") cleanLead.phone = null;
      
      const leadWithOrg = { ...cleanLead, organization_id: profile?.organization_id }
      
      console.log('CRM Store - Adding Lead (Cleaned):', leadWithOrg)

      const { data, error } = await supabase
        .from('leads')
        .insert(leadWithOrg)
        .select()
        .single()

      if (error) throw error

      // Audit Log
      logActivity({
        action: 'CREATE',
        targetType: 'lead',
        targetId: data.id,
        targetName: `${data.first_name} ${data.last_name}`,
        description: `New lead created: ${data.company || 'Individual'}`
      })

      // Auto-link to existing client if email matches
      if (data.email) {
        await supabase
          .from('clients')
          .update({ lead_id: data.id })
          .eq('email', data.email)
          .is('lead_id', null)
      }

      set({ leads: [data as Lead, ...get().leads], error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to add lead.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateLead: async (id, updates) => {
    try {
      // OPTIMISTIC UI UPDATE: Instantly move the card on the screen so it doesn't snap back
      if (updates.status) {
        // For virtual leads, also persist the status override so fetchLeads doesn't reset it
        const overrides = id.startsWith('virtual-lead-') 
          ? { virtualLeadStatusOverrides: { ...get().virtualLeadStatusOverrides, [id]: updates.status } }
          : {}
        set((state) => ({
          leads: state.leads.map((l) => (l.id === id ? { ...l, status: updates.status! } : l)),
          ...overrides
        }))
      }

      // Handle Virtual Leads (generated from Clients)
      if (id.startsWith('virtual-lead-')) {
        const clientId = id.replace('virtual-lead-', '')
        const client = get().clients.find(c => c.id === clientId)
        
        if (client) {
          // If the user drags the Virtual Lead to a new column, create a REAL lead for it immediately
          if (updates.status && updates.status !== 'closed_won') {
            const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
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
                organization_id: profile?.organization_id
              })
              .select()
              .single()

            if (leadError) {
              console.error("Self-healing lead insert failed:", leadError)
              throw new Error("Database Error: " + leadError.message)
            }

            if (newLead) {
              const { data: updatedClient, error: clientError } = await supabase
                .from('clients')
                .update({ lead_id: newLead.id })
                .eq('id', clientId)
                .select()
                .single()

              if (clientError || !updatedClient) {
                console.error("Self-healing client link failed:", clientError)
                throw new Error("Link Error: " + (clientError?.message || "Client not found"))
              }
                
              // Perfectly swap the virtual lead with the new real lead in local state
              set((state) => ({
                clients: state.clients.map(c => c.id === clientId ? { ...c, lead_id: newLead.id } : c),
                leads: state.leads.map(l => l.id === id ? (newLead as Lead) : l)
              }))
            }
          } else {
            // If just updating text fields, sync to the client record
            const clientUpdates: any = {}
            if (updates.first_name || updates.last_name) {
              clientUpdates.name = `${updates.first_name || ''} ${updates.last_name || ''}`.trim()
            }
            if (updates.email) clientUpdates.email = updates.email
            if (updates.value) clientUpdates.contract_value = updates.value

            if (Object.keys(clientUpdates).length > 0) {
              await get().updateClient(clientId, clientUpdates)
            }
            
            // For text updates, just patch the virtual lead locally
            set((state) => ({
              leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l))
            }))
          }
        }
        return
      }

      // Strip fields that don't exist in the database schema to prevent 400 Bad Request
      const { job_title, ...cleanUpdates } = updates as any;
      
      // Convert empty strings to null
      if (cleanUpdates.email === "") cleanUpdates.email = null;
      if (cleanUpdates.phone === "") cleanUpdates.phone = null;

      const { data, error } = await supabase
        .from('leads')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Audit Log
      if (updates.status) {
        logActivity({
          action: 'STATUS_CHANGE',
          targetType: 'lead',
          targetId: id,
          targetName: `${data.first_name} ${data.last_name}`,
          description: `Lead status changed to ${updates.status.replace('_', ' ')}`
        })
      } else {
        logActivity({
          action: 'UPDATE',
          targetType: 'lead',
          targetId: id,
          targetName: `${data.first_name} ${data.last_name}`,
          description: `Updated lead details`
        })
      }

      // Sync name forward to client if linked
      if (updates.first_name || updates.last_name) {
        const fullName = `${updates.first_name || data.first_name} ${updates.last_name || data.last_name || ''}`.trim()
        await supabase
          .from('clients')
          .update({ name: fullName })
          .eq('lead_id', id)
      }

      set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? (data as Lead) : l)),
        error: null,
      }))
      
      // Refresh clients to reflect sync
      get().fetchClients()
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update lead.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  // Safety helper to ensure a lead has a real client record before linking to projects/invoices
  ensureClientFromLead: async (leadId: string) => {
    try {
      console.log('CRM Store - ensureClientFromLead called with:', leadId)
      
      // CRITICAL: Verify directly in the DB if this ID is a real client row.
      // We cannot trust the in-memory store because won-leads appear in the 
      // clients list with isVirtual:false, making the local check unreliable.
      const { data: realClientCheck } = await supabase
        .from('clients')
        .select('id')
        .eq('id', leadId)
        .maybeSingle()

      if (realClientCheck) {
        console.log('CRM Store - DB confirms this is a real client ID, skipping conversion.')
        return realClientCheck.id
      }

      // Also check if it's already linked as a lead's client
      const { data: linkedClientCheck } = await supabase
        .from('clients')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle()

      if (linkedClientCheck) {
        console.log('CRM Store - Found existing client linked to this lead ID.')
        return linkedClientCheck.id
      }

      // Fetch lead to get its organization_id
      const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle()
      if (leadError || !lead || lead.status !== 'closed_won') {
        console.log('CRM Store - Not a convertible lead, returning original ID')
        return leadId
      }

      console.log('CRM Store - Identified lead for conversion:', lead.first_name)

      // Check if client already exists for this lead
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, name')
        .eq('lead_id', leadId)
        .maybeSingle()

      if (existingClient) {
        console.log('CRM Store - Existing client found for lead:', existingClient.name, 'ID:', existingClient.id)
        return existingClient.id
      }

      const { useAuthStore } = await import('@/store/useAuthStore')
      const profile = useAuthStore.getState().profile
      const orgId = lead.organization_id || profile?.organization_id

      // Create missing client record
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: `${lead.first_name} ${lead.last_name || ''}`.trim() || lead.company || 'Converted Lead',
          email: lead.email || null,
          phone: lead.phone || null,
          user_id: lead.user_id,
          lead_id: lead.id,
          organization_id: orgId
        })
        .select()
        .single()

      if (error) {
        // If it's a unique constraint violation, it means the client WAS created 
        // (perhaps by a parallel request or it exists in another org)
        if (error.code === '23505') {
          const { data: retryClient } = await supabase
            .from('clients')
            .select('id')
            .eq('lead_id', leadId)
            .maybeSingle()
          
          if (retryClient) return retryClient.id
        }
        throw error
      }
      return newClient.id
    } catch (err: any) {
      console.error('Failed to ensure client from lead:', err)
      // If we still fail, we MUST return a valid UUID or the FK check on projects will fail.
      // But we don't have one. Returning leadId will cause the 409 Conflict on projects.
      throw err 
    }
  },

  deleteLead: async (id) => {
    // Handle Virtual Leads
    if (id.startsWith('virtual-lead-')) {
      const clientId = id.replace('virtual-lead-', '')
      await get().deleteClient(clientId)
      await get().fetchLeads()
      return
    }

    const previousLeads = get().leads
    const deletedLead = previousLeads.find((l) => l.id === id)
    const deletedIndex = previousLeads.findIndex((l) => l.id === id)

    set({ leads: previousLeads.filter((l) => l.id !== id) })

    try {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error

      // Audit Log
      if (deletedLead) {
        logActivity({
          action: 'DELETE',
          targetType: 'lead',
          targetId: id,
          targetName: `${deletedLead.first_name} ${deletedLead.last_name}`,
          description: `Lead deleted from system`
        })
      }

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
      // Fetch actual clients - but only those that are NOT linked to a lead,
      // OR are linked to a lead that is still in 'closed_won' status.
      // This ensures that moving a lead out of 'closed_won' hides them from 'Active Clients'.
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*, leads!lead_id(status)')
        .order('created_at', { ascending: false })
        .range(0, 50)

      if (clientsError) throw clientsError

      // Filter clients based on linked lead status
      const activeClients = (clientsData as any[] || []).filter(client => {
        // If no lead_id, it's a manually added client - keep it
        if (!client.lead_id) return true
        // If it has a lead_id, check the status of that lead
        // The join returns lead as an object (or null)
        const leadStatus = client.leads?.status
        return leadStatus === 'closed_won'
      })

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
        phone: lead.phone || null,
        address: null,
        website: null,
        service: 'Lead Conversion',
        contract_value: lead.value,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        isVirtual: false // We show them as real clients so they appear in dropdowns
      }))

      // Combine and filter out duplicates
      const allClients = [...(activeClients as Client[])]
      
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
      
      // Clean the data: Remove frontend-only properties that don't exist in the DB
      const { isVirtual, ...dbClient } = client as any
      
      let leadId = dbClient.lead_id
      
      // If no lead_id is provided, we MUST create one so they show up in the Kanban
      if (!leadId) {
        // Try to find by email first to avoid duplicates
        if (dbClient.email) {
          const { data: matchedLead } = await supabase
            .from('leads')
            .select('id')
            .eq('email', dbClient.email)
            .maybeSingle()
          if (matchedLead) leadId = matchedLead.id
        }

        // If still no lead_id, create a new Lead record for this client
        if (!leadId) {
          const names = (dbClient.name || 'New Client').split(' ')
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              first_name: names[0],
              last_name: names.slice(1).join(' ') || null,
              email: dbClient.email,
              phone: dbClient.phone,
              status: 'closed_won',
              value: dbClient.contract_value || 0,
              organization_id: profile?.organization_id
            })
            .select()
            .single()
          
          if (!leadError) leadId = newLead.id
        }
      }

      const clientWithOrg = { ...dbClient, lead_id: leadId, organization_id: profile?.organization_id }
      
      const { data, error } = await supabase
        .from('clients')
        .insert(clientWithOrg)
        .select()
        .single()

      if (error) throw error
      set({ clients: [data as Client, ...get().clients], error: null, lastFetchedAt: Date.now() })
      
      // Refresh leads to show the new lead in Kanban
      get().fetchLeads()
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

      // Sync name back to lead if linked
      const names = updates.name ? updates.name.split(' ') : null
      const firstName = names ? names[0] : undefined
      const lastName = names ? names.slice(1).join(' ') || null : undefined

      if (data.lead_id && updates.name) {
        await supabase
          .from('leads')
          .update({ first_name: firstName, last_name: lastName })
          .eq('id', data.lead_id)
      }

      // Update clients AND leads arrays so the Kanban reflects changes instantly
      const virtualId = `virtual-lead-${id}`
      set({
        clients: get().clients.map((c) => (c.id === id ? (data as Client) : c)),
        leads: get().leads.map((l) => {
          // Update the linked real lead
          if (data.lead_id && l.id === data.lead_id && firstName) {
            return { ...l, first_name: firstName, last_name: lastName ?? l.last_name }
          }
          // Update the virtual lead
          if (l.id === virtualId && firstName) {
            return { ...l, first_name: firstName, last_name: lastName ?? l.last_name }
          }
          return l
        }),
        error: null,
        lastFetchedAt: Date.now(),
      })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update client.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  // NOTE: updateLead is defined earlier in this store (line ~145). Do NOT re-define it here.

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
        .range(0, 50)

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
      
      // Always call ensureClientFromLead — it now does a direct DB check,
      // so it safely handles both real client IDs and lead IDs (won leads).
      // It will create a real client record if one doesn't exist yet.
      let finalClientId = proposal.client_id;
      let finalLeadId = proposal.lead_id;

      if (proposal.client_id) {
        finalClientId = await get().ensureClientFromLead(proposal.client_id);
        // If the original ID was a lead ID, also set finalLeadId
        if (finalClientId !== proposal.client_id) {
          finalLeadId = proposal.client_id;
        }
      }

      // If we still don't have a lead_id, try to look it up from the real client
      if (!finalLeadId && finalClientId) {
        const { data: clientRow } = await supabase
          .from('clients').select('lead_id').eq('id', finalClientId).maybeSingle()
        if (clientRow?.lead_id) finalLeadId = clientRow.lead_id
      }

      const payload = { 
        ...proposal, 
        client_id: finalClientId,
        lead_id: finalLeadId,
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
