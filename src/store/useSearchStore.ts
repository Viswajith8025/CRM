import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type SearchResult = {
  id: string
  title: string
  subtitle?: string
  type: 'lead' | 'client' | 'project' | 'task' | 'invoice'
  url: string
}

interface SearchState {
  results: SearchResult[]
  isLoading: boolean
  search: (query: string) => Promise<void>
  clearResults: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  results: [],
  isLoading: false,

  search: async (query: string) => {
    if (!query.trim() || query.length < 2) {
      set({ results: [] })
      return
    }

    set({ isLoading: true })
    const term = `%${query}%`

    try {
      // Fallback to parallel standard queries to ensure RLS is respected for all roles
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      
      let queries = [
        supabase.from('leads').select('id, first_name, last_name, company').ilike('first_name', term).limit(5),
        supabase.from('clients').select('id, name, email').ilike('name', term).limit(5),
        supabase.from('projects').select('id, name, status').ilike('name', term).limit(5),
        supabase.from('tasks').select('id, title, status').ilike('title', term).limit(5),
        supabase.from('invoices').select('id, invoice_number, status').ilike('invoice_number', term).limit(5),
        supabase.from('profiles').select('id, full_name, email, role').ilike('full_name', term).limit(5)
      ]

      if (profile?.role !== 'super_admin' && orgId) {
        queries = queries.map(q => q.eq('organization_id', orgId))
      }

      const [leads, clients, projects, tasks, invoices, profiles] = await Promise.all(queries)

      const formattedResults: SearchResult[] = [
        ...(leads.data || []).map(r => ({ id: r.id, title: `${r.first_name} ${r.last_name || ''}`, subtitle: r.company || 'Lead', type: 'lead' as const, url: `/crm` })),
        ...(clients.data || []).map(r => ({ id: r.id, title: r.name, subtitle: r.email || 'Client', type: 'client' as const, url: `/clients` })),
        ...(projects.data || []).map(r => ({ id: r.id, title: r.name, subtitle: `Status: ${r.status}`, type: 'project' as const, url: `/projects` })),
        ...(tasks.data || []).map(r => ({ id: r.id, title: r.title, subtitle: `Status: ${r.status}`, type: 'task' as const, url: `/tasks` })),
        ...(invoices.data || []).map(r => ({ id: r.id, title: r.invoice_number, subtitle: `Status: ${r.status}`, type: 'invoice' as const, url: `/billing` })),
        ...(profiles.data || []).map(r => ({ id: r.id, title: r.full_name || r.email || 'Unknown', subtitle: r.role || 'Employee', type: 'employee' as const, url: `/settings` }))
      ]

      set({ results: formattedResults })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  clearResults: () => set({ results: [] })
}))
