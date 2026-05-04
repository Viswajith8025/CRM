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
      // Parallel search across tables
      const [leads, clients, projects, tasks, invoices] = await Promise.all([
        supabase.from('leads').select('id, first_name, last_name, company').or(`first_name.ilike.${term},last_name.ilike.${term},company.ilike.${term}`).limit(5),
        supabase.from('clients').select('id, name, company:leads(company)').ilike('name', term).limit(5),
        supabase.from('projects').select('id, name, client:clients(name)').ilike('name', term).limit(5),
        supabase.from('tasks').select('id, title, status').ilike('title', term).limit(5),
        supabase.from('invoices').select('id, invoice_number, amount').ilike('invoice_number', term).limit(5),
      ])

      const formattedResults: SearchResult[] = [
        ...(leads.data || []).map(l => ({
          id: l.id,
          title: `${l.first_name} ${l.last_name}`,
          subtitle: l.company,
          type: 'lead' as const,
          url: `/crm?id=${l.id}`
        })),
        ...(clients.data || []).map(c => ({
          id: c.id,
          title: c.name,
          subtitle: (c.company as any)?.company || 'Active Client',
          type: 'client' as const,
          url: `/clients?id=${c.id}`
        })),
        ...(projects.data || []).map(p => ({
          id: p.id,
          title: p.name,
          subtitle: (p.client as any)?.name,
          type: 'project' as const,
          url: `/projects/${p.id}`
        })),
        ...(tasks.data || []).map(t => ({
          id: t.id,
          title: t.title,
          subtitle: `Status: ${t.status}`,
          type: 'task' as const,
          url: `/tasks?id=${t.id}`
        })),
        ...(invoices.data || []).map(i => ({
          id: i.id,
          title: `Invoice ${i.invoice_number}`,
          subtitle: `$${i.amount.toLocaleString()}`,
          type: 'invoice' as const,
          url: `/billing/${i.id}`
        })),
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
