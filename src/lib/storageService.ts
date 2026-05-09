import { supabase } from '@/lib/supabase'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/zip'
]

export const storageService = {
  /**
   * Securely uploads a file with validation and organization isolation.
   */
  async uploadFile(
    file: File,
    entityType: 'project' | 'invoice' | 'client' | 'task',
    entityId: string
  ) {
    // 1. Validation
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is 10MB.`)
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed for security reasons.`)
    }

    // 2. Get Org Context
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    
    if (!profile?.organization_id) throw new Error("Organization context not found.")

    const orgId = profile.organization_id
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const filePath = `${orgId}/${entityType}/${fileName}`

    // 3. Perform Upload
    const { data, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    // 4. Register in Database (Triggers quota check)
    const { error: dbError } = await supabase
      .from('attachments')
      .insert({
        organization_id: orgId,
        bucket_id: 'documents',
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: user.id
      })

    if (dbError) {
      // Rollback storage upload if DB registration fails (e.g. quota exceeded)
      await supabase.storage.from('documents').remove([filePath])
      throw dbError
    }

    return { filePath, fileName: file.name }
  },

  /**
   * Generates a short-lived signed URL for secure file access.
   */
  async getDownloadUrl(filePath: string) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60) // 60 seconds expiry

    if (error) throw error
    return data.signedUrl
  },

  /**
   * Fetches the current storage usage for the organization.
   */
  async getStorageUsage() {
    const { data, error } = await supabase
      .from('organization_storage_stats')
      .select('*')
      .single()
    
    if (error) throw error
    return data
  }
}
