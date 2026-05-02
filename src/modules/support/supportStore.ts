import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { SupportTicket, TicketMessage, KnowledgeArticle } from './types'
import { addHours } from 'date-fns'

interface SupportState {
  tickets: SupportTicket[]
  messages: Record<string, TicketMessage[]>
  articles: KnowledgeArticle[]
  isLoading: boolean
  error: string | null

  fetchTickets: () => Promise<void>
  fetchTicketById: (id: string) => Promise<SupportTicket | null>
  fetchMessages: (ticketId: string) => Promise<void>
  fetchArticles: () => Promise<void>

  createTicket: (ticket: Partial<SupportTicket>) => Promise<void>
  updateTicket: (id: string, updates: Partial<SupportTicket>) => Promise<void>
  addMessage: (message: Partial<TicketMessage>) => Promise<void>
  createArticle: (article: Partial<KnowledgeArticle>) => Promise<void>
}

export const useSupportStore = create<SupportState>((set, get) => ({
  tickets: [],
  messages: {},
  articles: [],
  isLoading: false,
  error: null,

  fetchTickets: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, client:clients(name, email), assignee:profiles!assigned_to(full_name, avatar_url)')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ tickets: data as SupportTicket[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load tickets.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchTicketById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, client:clients(name, email), assignee:profiles!assigned_to(full_name, avatar_url)')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as SupportTicket
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  fetchMessages: async (ticketId) => {
    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*, sender:profiles!sender_id(full_name, avatar_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      
      set(state => ({
        messages: {
          ...state.messages,
          [ticketId]: data as TicketMessage[]
        }
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  fetchArticles: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ articles: data as KnowledgeArticle[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load knowledge base.") })
    } finally {
      set({ isLoading: false })
    }
  },

  createTicket: async (ticket) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      
      // Calculate SLA Deadline
      let slaHours = 72 // low
      if (ticket.priority === 'medium') slaHours = 48
      if (ticket.priority === 'high') slaHours = 24
      if (ticket.priority === 'urgent') slaHours = 4

      const payload = { 
        ...ticket, 
        organization_id: profile?.organization_id,
        sla_deadline: addHours(new Date(), slaHours).toISOString()
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .insert(payload)
        .select('*, client:clients(name, email), assignee:profiles!assigned_to(full_name, avatar_url)')
        .single()
      
      if (error) throw error
      set(state => ({ tickets: [data as SupportTicket, ...state.tickets] }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  updateTicket: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', id)
        .select('*, client:clients(name, email), assignee:profiles!assigned_to(full_name, avatar_url)')
        .single()
      
      if (error) throw error
      set(state => ({
        tickets: state.tickets.map(t => t.id === id ? (data as SupportTicket) : t)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  addMessage: async (message) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...message, sender_id: profile?.id }

      const { data, error } = await supabase
        .from('support_ticket_messages')
        .insert(payload)
        .select('*, sender:profiles!sender_id(full_name, avatar_url)')
        .single()
      
      if (error) throw error
      
      if (message.ticket_id) {
        set(state => ({
          messages: {
            ...state.messages,
            [message.ticket_id]: [...(state.messages[message.ticket_id] || []), data as TicketMessage]
          }
        }))
      }
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  createArticle: async (article) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...article, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert(payload)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({ articles: [data as KnowledgeArticle, ...state.articles] }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  }
}))
