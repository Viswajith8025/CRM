import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { DocumentRecord } from './types'

interface DocumentState {
  documents: DocumentRecord[]
  isLoading: boolean
  error: string | null

  fetchDocuments: (projectId?: string) => Promise<void>
  addDocument: (doc: Partial<DocumentRecord>) => Promise<void>
  updateDocumentStatus: (id: string, status: DocumentRecord['status']) => Promise<void>
  incrementVersion: (id: string, newUrl: string) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,

  fetchDocuments: async (projectId?: string) => {
    set({ isLoading: true })
    try {
      let query = supabase
        .from('documents')
        .select('*, profile:profiles(*), client:clients(name), project:projects(name)')
        .order('created_at', { ascending: false })
      
      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query
      
      if (error) throw error
      set({ documents: data as DocumentRecord[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load documents.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addDocument: async (doc) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { 
        ...doc, 
        organization_id: profile?.organization_id,
        uploaded_by: profile?.id
      }

      const { data, error } = await supabase
        .from('documents')
        .insert(payload)
        .select('*, profile:profiles(*), client:clients(name), project:projects(name)')
        .single()
      
      if (error) throw error
      set(state => ({ documents: [data as DocumentRecord, ...state.documents] }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  updateDocumentStatus: async (id, status) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', id)
        .select('*, profile:profiles(*), client:clients(name), project:projects(name)')
        .single()
      
      if (error) throw error
      set(state => ({
        documents: state.documents.map(d => d.id === id ? (data as DocumentRecord) : d)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  incrementVersion: async (id, newUrl) => {
    try {
      const doc = get().documents.find(d => d.id === id)
      if (!doc) throw new Error("Document not found")

      const newVersion = (doc.version || 1) + 1

      const { data, error } = await supabase
        .from('documents')
        .update({ version: newVersion, file_url: newUrl, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, profile:profiles(*), client:clients(name), project:projects(name)')
        .single()

      if (error) throw error
      set(state => ({
        documents: state.documents.map(d => d.id === id ? (data as DocumentRecord) : d)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  deleteDocument: async (id) => {
    const previousDocs = get().documents
    set({ documents: previousDocs.filter(d => d.id !== id) })

    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
    } catch (err: any) {
      const friendlyError = toFriendlyError(err, "Failed to delete document.")
      set({ documents: previousDocs, error: friendlyError.message })
      throw friendlyError
    }
  }
}))
