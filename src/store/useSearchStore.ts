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
      // Use the optimized Database RPC for unified global search
      const { data, error } = await supabase.rpc('global_search', {
        p_query: query,
        p_limit: 20
      })
      
      if (error) throw error

      const formattedResults: SearchResult[] = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        type: r.type,
        url: r.link
      }))

      set({ results: formattedResults })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  clearResults: () => set({ results: [] })
}))
