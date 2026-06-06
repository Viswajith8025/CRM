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
  requirement: string | null
  brought_by_id: string | null
  remarks: string | null
  whatsapp?: string | null
  website?: string | null
  address?: string | null
  business_type?: string | null
  services_needed?: string | null
  target_locations?: string | null
  has_instagram?: boolean
  ig_username?: string | null
  ig_password?: string | null
  li_username?: string | null
  li_password?: string | null
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

export interface BDEReport {
  id: string;
  organization_id: string;
  user_id: string;
  report_date: string;
  database_planned: string | null;
  database_count: number;
  leads_social_media: number;
  leads_just_dial: number;
  leads_other: number;
  meetings_scheduled: number;
  meetings_attended: number | null;
  calls_connected: number | null;
  amount_collected: number | null;
  remarks: string | null;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
}
