import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { DocumentRecord } from '../types/types'

interface UploadParams {
  file: File
  bucket: 'task-attachments' | 'invoices' | 'documents'
  relatedId: string
  relatedType: DocumentRecord['related_entity_type']
  folder?: string
  clientId?: string
}

interface DocumentState {
  documents: DocumentRecord[]
  isLoading: boolean
  error: string | null

  fetchDocuments: (relatedId?: string, relatedType?: string, clientId?: string) => Promise<void>
  fetchVersions: (documentId: string) => Promise<any[]>
  uploadFile: (params: UploadParams) => Promise<DocumentRecord>
  bulkUpload: (files: File[], bucket: UploadParams['bucket'], relatedId: string, relatedType: UploadParams['relatedType'], folder?: string, clientId?: string) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  trackAccess: (id: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,

  fetchDocuments: async (relatedId, relatedType, clientId) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      let query = supabase
        .from('documents')
        .select('*, profile:profiles(full_name, avatar_url)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      
      if (relatedId) query = query.eq('related_entity_id', relatedId)
      if (relatedType) query = query.eq('related_entity_type', relatedType)
      if (clientId) query = query.eq('client_id', clientId)

      const { data, error } = await query
      
      if (error) throw error
      set({ documents: data as DocumentRecord[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load documents.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchVersions: async (documentId) => {
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*, profile:profiles(full_name, avatar_url)')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
      
      if (error) throw error
      return data
    } catch (err) {
      console.error("Failed to fetch document versions:", err)
      return []
    }
  },

  uploadFile: async ({ file, bucket, relatedId, relatedType, folder, clientId }) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      if (!profile) throw new Error("Unauthorized")

      const orgId = profile.organization_id
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${orgId}/${relatedType}/${relatedId}/${fileName}`

      // 1. Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file)

      if (storageError) throw storageError

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      // 3. Save Metadata to DB
      const { data: dbData, error: dbError } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          size_bytes: file.size,
          mime_type: file.type,
          file_path: filePath,
          bucket_name: bucket,
          file_url: publicUrl,
          related_entity_id: relatedId,
          related_entity_type: relatedType,
          organization_id: orgId,
          user_id: profile.id,
          folder: folder || 'Assets',
          client_id: clientId
        })
        .select('*, profile:profiles(full_name, avatar_url)')
        .single()

      if (dbError) {
        // Cleanup storage if DB insert fails (Senior move)
        await supabase.storage.from(bucket).remove([filePath])
        throw dbError
      }

      const newDoc = dbData as DocumentRecord
      set(state => ({ documents: [newDoc, ...state.documents] }))
      return newDoc
    } catch (err) {
      console.error("Upload failed:", err)
      throw toFriendlyError(err, "Failed to upload file.")
    }
  },

  bulkUpload: async (files, bucket, relatedId, relatedType, folder, clientId) => {
    set({ isLoading: true })
    try {
      for (const file of files) {
        await get().uploadFile({ file, bucket, relatedId, relatedType, folder, clientId })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  deleteDocument: async (id) => {
    try {
      const doc = get().documents.find(d => d.id === id)
      if (!doc) return

      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from(doc.bucket_name)
        .remove([doc.file_path])

      if (storageError) throw storageError

      // 2. Delete from DB
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (dbError) throw dbError

      set(state => ({ documents: state.documents.filter(d => d.id !== id) }))
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete file.")
    }
  },

  trackAccess: async (id) => {
    try {
      await supabase.rpc('track_document_access', { p_doc_id: id })
    } catch (err) {
      console.warn("Failed to track document access")
    }
  }
}))

