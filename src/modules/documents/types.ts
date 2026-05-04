export interface DocumentRecord {
  id: string
  name: string
  file_url: string
  mime_type: string
  size_bytes: number
  bucket_name: string
  file_path: string
  
  // Related entities
  related_entity_id: string | null
  related_entity_type: 'task' | 'invoice' | 'project' | 'client' | 'other'
  
  organization_id: string
  user_id: string
  
  created_at: string
  updated_at: string
  
  // Joins
  profile?: { full_name: string, avatar_url: string }
  client?: { name: string }
  project?: { name: string }
  
  // Legacy support for older components
  title?: string
  category?: string
  status?: string
}
