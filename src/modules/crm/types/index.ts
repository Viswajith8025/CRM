export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'awaiting_payment' | 'active_client' | 'closed_lost';

export interface Contact {
  id: string
  user_id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  status: LeadStatus
  source: string | null
  assigned_to: string | null
  value: number | null
  score: number
  segment: string
  next_follow_up: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  lead_id: string
  user_id: string
  type: 'call' | 'whatsapp' | 'email' | 'meeting'
  content: string
  created_at: string
}

export interface Proposal {
  id: string
  lead_id?: string
  client_id?: string
  user_id: string
  title: string
  amount: number
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  content: any
  valid_until: string
  created_at: string
}

export interface Note {
  id: string
  lead_id: string
  user_id: string
  content: string
  created_at: string
}
export interface Client {
  id: string
  user_id: string
  lead_id?: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  service: string | null
  contract_value: number | null
  created_at: string
  updated_at: string
  isVirtual?: boolean
}
