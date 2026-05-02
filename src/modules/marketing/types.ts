export interface Campaign {
  id: string
  name: string
  platform: 'google_ads' | 'meta_ads' | 'email' | 'linkedin'
  status: 'active' | 'paused' | 'completed' | 'draft'
  budget: number
  spend: number
  start_date: string
  end_date: string | null
  organization_id?: string
  created_at: string
  updated_at: string
  leads_count?: number
}

export interface SEOKeyword {
  id: string
  keyword: string
  target_url: string
  search_volume: number
  current_rank: number | null
  previous_rank: number | null
  difficulty: number | null
  organization_id?: string
  created_at: string
  updated_at: string
}

export interface SocialPost {
  id: string
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram'
  content: string
  media_url: string | null
  scheduled_for: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  organization_id?: string
  created_at: string
  updated_at: string
}
