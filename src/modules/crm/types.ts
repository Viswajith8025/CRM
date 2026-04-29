export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface Contact {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  company: string | null
  status: LeadStatus
  source: string | null
  assigned_to: string | null
  value: number | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  lead_id: string
  user_id: string
  content: string
  created_at: string
}
