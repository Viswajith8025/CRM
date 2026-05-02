export interface DocumentRecord {
  id: string
  title: string
  file_url: string
  file_type: string
  file_size: number
  category: 'proposal' | 'contract' | 'asset' | 'general'
  version: number
  client_id: string | null
  project_id: string | null
  status: 'draft' | 'active' | 'archived'
  organization_id?: string
  uploaded_by: string
  created_at: string
  updated_at: string
  profile?: { full_name: string, avatar_url: string }
  client?: { name: string }
  project?: { name: string }
}
